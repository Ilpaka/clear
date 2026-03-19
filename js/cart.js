(function () {
  'use strict';

  const API_BASE = 'http://localhost:8080';
  const CART_STORAGE_KEY = 'cart';
  const CART_ID_KEY = 'cart_id';

  let cartState = { id: null, items: [] };

  function getCartId() {
    return localStorage.getItem(CART_ID_KEY);
  }

  function setCartId(id) {
    if (id) localStorage.setItem(CART_ID_KEY, id);
  }

  function saveToStorage() {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartState));
  }

  function loadFromStorage() {
    try {
      const raw = localStorage.getItem(CART_STORAGE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && parsed.items) {
          cartState = parsed;
          return true;
        }
      }
    } catch (e) {}
    return false;
  }

  function getTotalCount() {
    return (cartState.items || []).reduce(function (sum, it) { return sum + (it.quantity || 0); }, 0);
  }

  function getTotalSum() {
    return (cartState.items || []).reduce(function (sum, it) {
      return sum + ((it.price || 0) * (it.quantity || 0));
    }, 0);
  }

  function formatPrice(price) {
    return new Intl.NumberFormat('ru-RU').format(price) + ' ₽';
  }

  function updateCounter() {
    var els = document.querySelectorAll('.cart-count');
    var count = getTotalCount();
    els.forEach(function (el) { el.textContent = String(count); });
  }

  function applyCartState(data) {
    if (!data) return;
    cartState.id = data.id || cartState.id;
    cartState.items = Array.isArray(data.items) ? data.items : [];
    setCartId(cartState.id);
    saveToStorage();
  }

  function apiHeaders() {
    var h = { 'Content-Type': 'application/json' };
    var cid = getCartId();
    if (cid) h['X-Cart-ID'] = cid;
    return h;
  }

  function fetchCart() {
    return fetch(API_BASE + '/api/cart', { headers: apiHeaders() })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        applyCartState(data);
        return data;
      });
  }

  window.addToCart = function (item) {
    var payload = {
      productId: item.productId,
      quantity: item.quantity || 1,
      name: item.name,
      price: item.price,
      image: item.image,
      options: item.options
    };

    fetch(API_BASE + '/api/cart/add', {
      method: 'POST',
      headers: apiHeaders(),
      body: JSON.stringify(payload)
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        applyCartState(data);
        updateCounter();
      })
      .catch(function () {
        cartState.items = cartState.items || [];
        var existing = cartState.items.find(function (i) {
          return i.productId === item.productId && JSON.stringify(i.options || {}) === JSON.stringify(item.options || {});
        });
        if (existing) existing.quantity += item.quantity || 1;
        else {
          cartState.items.push({
            id: 'local-' + Date.now() + '-' + Math.random().toString(36).slice(2),
            productId: item.productId,
            name: item.name,
            price: item.price,
            quantity: item.quantity || 1,
            image: item.image,
            options: item.options
          });
        }
        saveToStorage();
        updateCounter();
      });
  };

  function updateQuantity(itemId, productId, quantity) {
    var url = API_BASE + '/api/cart/update';
    var body = quantity === 0
      ? (itemId ? { itemId: itemId, quantity: 0 } : { productId: productId, quantity: 0 })
      : (itemId ? { itemId: itemId, quantity: quantity } : { productId: productId, quantity: quantity });

    fetch(url, {
      method: 'PUT',
      headers: apiHeaders(),
      body: JSON.stringify(body)
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        applyCartState(data);
        updateCounter();
        renderCartPage();
      })
      .catch(function () {
        var items = cartState.items || [];
        for (var i = 0; i < items.length; i++) {
          if ((itemId && items[i].id === itemId) || (productId && items[i].productId === productId)) {
            if (quantity === 0) items.splice(i, 1);
            else items[i].quantity = quantity;
            break;
          }
        }
        applyCartState({ items: items });
        saveToStorage();
        updateCounter();
        renderCartPage();
      });
  }

  function removeItem(itemId, productId) {
    var id = itemId || productId;
    if (!id) return;

    fetch(API_BASE + '/api/cart/item/' + encodeURIComponent(id), {
      method: 'DELETE',
      headers: apiHeaders()
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        applyCartState(data);
        updateCounter();
        renderCartPage();
      })
      .catch(function () {
        cartState.items = (cartState.items || []).filter(function (i) {
          return i.id !== id && i.productId !== id;
        });
        saveToStorage();
        updateCounter();
        renderCartPage();
      });
  }

  function renderCartItem(item) {
    var row = document.createElement('div');
    row.className = 'cart-item';
    row.dataset.itemId = item.id;
    row.dataset.productId = item.productId;

    var subtotal = (item.price || 0) * (item.quantity || 1);
    var img = item.image
      ? '<img src="' + item.image + '" alt="" class="cart-item-image" />'
      : '<div class="cart-item-image cart-item-image-placeholder"></div>';

    row.innerHTML =
      '<div class="cart-item-main">' +
        img +
        '<div class="cart-item-info">' +
          '<h4 class="cart-item-name">' + (item.name || 'Товар') + '</h4>' +
          '<p class="cart-item-price">' + formatPrice(item.price) + ' за шт.</p>' +
        '</div>' +
      '</div>' +
      '<div class="cart-item-controls">' +
        '<button type="button" class="cart-btn cart-btn-minus" aria-label="Уменьшить">−</button>' +
        '<span class="cart-item-qty">' + (item.quantity || 1) + '</span>' +
        '<button type="button" class="cart-btn cart-btn-plus" aria-label="Увеличить">+</button>' +
      '</div>' +
      '<div class="cart-item-subtotal">' + formatPrice(subtotal) + '</div>' +
      '<button type="button" class="cart-btn cart-btn-remove" aria-label="Удалить">✕</button>';

    var minus = row.querySelector('.cart-btn-minus');
    var plus = row.querySelector('.cart-btn-plus');
    var remove = row.querySelector('.cart-btn-remove');

    minus.addEventListener('click', function () {
      var q = item.quantity || 1;
      if (q <= 1) removeItem(item.id, item.productId);
      else updateQuantity(item.id, item.productId, q - 1);
    });
    plus.addEventListener('click', function () {
      updateQuantity(item.id, item.productId, (item.quantity || 1) + 1);
    });
    remove.addEventListener('click', function () {
      removeItem(item.id, item.productId);
    });

    return row;
  }

  function renderCartPage() {
    var container = document.getElementById('cart-items');
    var emptyEl = document.getElementById('cart-empty');
    var summaryEl = document.getElementById('cart-summary');
    var totalEl = document.getElementById('cart-total-value');

    if (!container) return;

    var items = cartState.items || [];
    container.innerHTML = '';

    if (items.length === 0) {
      container.style.display = 'none';
      if (emptyEl) emptyEl.style.display = 'block';
      if (summaryEl) summaryEl.style.display = 'none';
      return;
    }

    container.style.display = 'block';
    if (emptyEl) emptyEl.style.display = 'none';
    if (summaryEl) summaryEl.style.display = 'block';

    items.forEach(function (it) {
      container.appendChild(renderCartItem(it));
    });

    if (totalEl) totalEl.textContent = formatPrice(getTotalSum());
  }

  function init() {
    loadFromStorage();
    updateCounter();

    fetchCart()
      .then(function () {
        updateCounter();
        renderCartPage();
      })
      .catch(function () {
        updateCounter();
        renderCartPage();
      });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
