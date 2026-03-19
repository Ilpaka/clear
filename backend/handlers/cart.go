package handlers

import (
	"encoding/json"
	"net/http"
	"sync"

	"github.com/google/uuid"
)

const cartIDHeader = "X-Cart-ID"
const cartIDCookie = "cart_id"

// CartItem represents a single item in the cart
type CartItem struct {
	ID        string                 `json:"id"`
	ProductID string                 `json:"productId"`
	Name      string                 `json:"name"`
	Price     int                    `json:"price"`
	Quantity  int                    `json:"quantity"`
	Image     string                 `json:"image,omitempty"`
	Options   map[string]interface{} `json:"options,omitempty"`
}

// Cart represents the shopping cart
type Cart struct {
	ID    string      `json:"id"`
	Items []CartItem  `json:"items"`
	mu    sync.RWMutex
}

// AddItemRequest is the request body for adding an item
type AddItemRequest struct {
	ProductID string                 `json:"productId"`
	Quantity  int                    `json:"quantity"`
	Name      string                 `json:"name"`
	Price     int                    `json:"price"`
	Image     string                 `json:"image,omitempty"`
	Options   map[string]interface{} `json:"options,omitempty"`
}

// UpdateItemRequest is the request body for updating quantity
type UpdateItemRequest struct {
	ItemID   string `json:"itemId"`   // optional, for line-level update
	ProductID string `json:"productId"` // fallback
	Quantity  int    `json:"quantity"`
}

var (
	carts   = make(map[string]*Cart)
	cartsMu sync.RWMutex
)

func getCartID(r *http.Request) string {
	if id := r.Header.Get("X-Cart-ID"); id != "" {
		return id
	}
	if c, _ := r.Cookie("cart_id"); c != nil && c.Value != "" {
		return c.Value
	}
	return ""
}

func getOrCreateCart(w http.ResponseWriter, r *http.Request) *Cart {
	cartID := getCartID(r)

	cartsMu.RLock()
	cart, exists := carts[cartID]
	cartsMu.RUnlock()

	if exists && cart != nil {
		return cart
	}

	newID := uuid.New().String()
	cart = &Cart{ID: newID, Items: []CartItem{}}
	cartsMu.Lock()
	carts[newID] = cart
	cartsMu.Unlock()

	w.Header().Set("X-Cart-ID", newID)
	http.SetCookie(w, &http.Cookie{
		Name:     "cart_id",
		Value:    newID,
		Path:     "/",
		SameSite: http.SameSiteLaxMode,
	})
	return cart
}

func jsonResponse(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func jsonError(w http.ResponseWriter, status int, msg string) {
	jsonResponse(w, status, map[string]string{"error": msg})
}

// GetCart returns the current cart
func GetCart(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		jsonError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	cart := getOrCreateCart(w, r)
	cart.mu.RLock()
	items := make([]CartItem, len(cart.Items))
	copy(items, cart.Items)
	cart.mu.RUnlock()

	jsonResponse(w, http.StatusOK, map[string]interface{}{
		"id":    cart.ID,
		"items": items,
	})
}

// AddToCart adds an item to the cart
func AddToCart(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	var req AddItemRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.ProductID == "" || req.Quantity < 1 {
		jsonError(w, http.StatusBadRequest, "productId and quantity (>=1) required")
		return
	}

	cart := getOrCreateCart(w, r)
	cart.mu.Lock()
	defer cart.mu.Unlock()

	// Merge only if same productId AND same options (for variative products)
	optsKey, _ := json.Marshal(req.Options)
	for i := range cart.Items {
		existingOpts, _ := json.Marshal(cart.Items[i].Options)
		if cart.Items[i].ProductID == req.ProductID && string(existingOpts) == string(optsKey) {
			cart.Items[i].Quantity += req.Quantity
			jsonResponse(w, http.StatusOK, map[string]interface{}{
				"id":    cart.ID,
				"items": cart.Items,
			})
			return
		}
	}

	cart.Items = append(cart.Items, CartItem{
		ID:        uuid.New().String(),
		ProductID: req.ProductID,
		Name:      req.Name,
		Price:     req.Price,
		Quantity:  req.Quantity,
		Image:     req.Image,
		Options:   req.Options,
	})

	jsonResponse(w, http.StatusOK, map[string]interface{}{
		"id":    cart.ID,
		"items": cart.Items,
	})
}

// UpdateCart updates item quantity by itemId or productId
func UpdateCart(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		jsonError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	var req UpdateItemRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.Quantity < 0 {
		jsonError(w, http.StatusBadRequest, "quantity (>=0) required")
		return
	}
	if req.ItemID == "" && req.ProductID == "" {
		jsonError(w, http.StatusBadRequest, "itemId or productId required")
		return
	}

	cart := getOrCreateCart(w, r)
	cart.mu.Lock()
	defer cart.mu.Unlock()

	idx := -1
	for i := range cart.Items {
		if req.ItemID != "" && cart.Items[i].ID == req.ItemID {
			idx = i
			break
		}
		if req.ItemID == "" && cart.Items[i].ProductID == req.ProductID {
			idx = i
			break
		}
	}
	if idx < 0 {
		jsonError(w, http.StatusNotFound, "Item not found")
		return
	}

	if req.Quantity == 0 {
		cart.Items = append(cart.Items[:idx], cart.Items[idx+1:]...)
	} else {
		cart.Items[idx].Quantity = req.Quantity
	}

	jsonResponse(w, http.StatusOK, map[string]interface{}{
		"id":    cart.ID,
		"items": cart.Items,
	})
}

// DeleteCartItem removes an item by itemId or productId (from URL path)
func DeleteCartItem(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		jsonError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	id := r.PathValue("id")
	if id == "" {
		jsonError(w, http.StatusBadRequest, "id required")
		return
	}

	cart := getOrCreateCart(w, r)
	cart.mu.Lock()
	defer cart.mu.Unlock()

	for i := range cart.Items {
		if cart.Items[i].ID == id || cart.Items[i].ProductID == id {
			cart.Items = append(cart.Items[:i], cart.Items[i+1:]...)
			jsonResponse(w, http.StatusOK, map[string]interface{}{
				"id":    cart.ID,
				"items": cart.Items,
			})
			return
		}
	}

	jsonError(w, http.StatusNotFound, "Item not found")
}
