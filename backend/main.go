package main

import (
	"log"
	"net/http"
	"os"

	"cart-api/handlers"
)

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin == "" {
			origin = "*"
		}
		w.Header().Set("Access-Control-Allow-Origin", origin)
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, X-Cart-ID")
		w.Header().Set("Access-Control-Allow-Credentials", "true")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func main() {
	mux := http.NewServeMux()

	mux.HandleFunc("GET /api/cart", handlers.GetCart)
	mux.HandleFunc("POST /api/cart/add", handlers.AddToCart)
	mux.HandleFunc("PUT /api/cart/update", handlers.UpdateCart)
	mux.HandleFunc("DELETE /api/cart/item/{id}", handlers.DeleteCartItem)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	handler := corsMiddleware(mux)
	log.Printf("Cart API listening on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, handler))
}
