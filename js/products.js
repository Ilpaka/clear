(function () {
  'use strict';

  const API_BASE = 'http://localhost:8080';

  const products = [
    {
      id: 'tg-bot-base',
      name: 'Разработка ТГ-бота',
      price: 5000,
      basePrice: 5000,
      image: 'https://placehold.co/400x240/1a1a1a/3b82f6?text=Telegram+Bot',
      article: 'TG-BOT-001',
      category: 'bots',
      description: 'Базовый Telegram-бот под ваши задачи: команды, меню, уведомления. Минимальный функционал для старта.',
      variative: true,
      options: [
        { id: 'payment', name: 'Интеграция системы оплаты', price: 3000 },
        { id: 'club', name: 'Система слежения за клубом', price: 4000 },
        { id: 'admin', name: 'Админ-панель', price: 5000 }
      ]
    },
    {
      id: 'site-landing',
      name: 'Лендинг',
      price: 15000,
      image: 'https://placehold.co/400x240/1a1a1a/8b5cf6?text=Landing',
      article: 'SITE-L-001',
      category: 'sites',
      description: 'Одностраничный сайт с формой заявки, адаптивная вёрстка, оптимизация под поисковики.'
    },
    {
      id: 'site-corporate',
      name: 'Корпоративный сайт',
      price: 35000,
      image: 'https://placehold.co/400x240/1a1a1a/3b82f6?text=Corporate',
      article: 'SITE-C-001',
      category: 'sites',
      description: 'Многостраничный сайт с каталогом услуг, блогом, формой обратной связи.'
    },
    {
      id: 'site-shop',
      name: 'Интернет-магазин',
      price: 80000,
      image: 'https://placehold.co/400x240/1a1a1a/8b5cf6?text=E-Commerce',
      article: 'SITE-S-001',
      category: 'sites',
      description: 'Каталог, корзина, checkout, интеграция платёжных систем, личный кабинет.'
    },
    {
      id: 'site-saas',
      name: 'Веб-приложение (SaaS)',
      price: 150000,
      image: 'https://placehold.co/400x240/1a1a1a/3b82f6?text=SaaS',
      article: 'SITE-SAAS-001',
      category: 'sites',
      description: 'Интерактивная панель управления, подписки, роли и доступы, аналитика.'
    },
    {
      id: 'site-portfolio',
      name: 'Портфолио / блог',
      price: 25000,
      image: 'https://placehold.co/400x240/1a1a1a/8b5cf6?text=Portfolio',
      article: 'SITE-P-001',
      category: 'sites',
      description: 'Персональный сайт с галереей работ и блогом. CMS для контента.'
    }
  ];

  let currentFilter = 'all';
  let currentPriceFilter = null;

  function formatPrice(price) {
    return new Intl.NumberFormat('ru-RU').format(price) + ' ₽';
  }

  function getProductPrice(product, selectedOptions) {
    if (!product.variative || !selectedOptions) return product.price;
    let total = product.basePrice || product.price;
    (selectedOptions || []).forEach(function (opt) {
      var o = product.options.find(function (x) { return x.id === opt; });
      if (o) total += o.price;
    });
    return total;
  }

  function getProductIdWithOptions(product, selectedOptions) {
    if (!product.variative || !selectedOptions || selectedOptions.length === 0) {
      return product.id;
    }
    return product.id + '-' + (selectedOptions || []).sort().join('-');
  }

  function renderProductCard(product, container) {
    var selected = product.variative ? [] : null;
    var price = getProductPrice(product, selected);

    var card = document.createElement('article');
    card.className = 'product-card project-card';
    card.dataset.productId = product.id;

    var imgBlock = '<div class="project-image product-card-image">' +
      '<img src="' + product.image + '" alt="' + product.name + '" loading="lazy" />' +
      '</div>';
    var content = '<div class="project-content product-card-content">' +
      '<h3 class="project-title product-card-title" tabindex="0">' + product.name + '</h3>' +
      '<p class="product-card-article">Арт. ' + product.article + '</p>' +
      (product.variative
        ? '<div class="product-options"><p class="product-options-title">Опции:</p><div class="product-options-list"></div><p class="product-price">' + formatPrice(price) + '</p></div>'
        : '<p class="product-price">' + formatPrice(price) + '</p>') +
      '<button type="button" class="btn btn-primary btn-add-to-cart">В корзину</button>' +
      '</div>';

    card.innerHTML = imgBlock + content;

    var titleEl = card.querySelector('.product-card-title');
    var imgEl = card.querySelector('.project-image img');

    function openModal() {
      if (window.openProductModal) window.openProductModal(product);
    }

    titleEl.addEventListener('click', openModal);
    imgEl.addEventListener('click', openModal);

    if (product.variative) {
      var optsList = card.querySelector('.product-options-list');
      var priceEl = card.querySelector('.product-price');
      product.options.forEach(function (opt) {
        var label = document.createElement('label');
        label.className = 'product-option-label';
        label.innerHTML = '<input type="checkbox" data-option="' + opt.id + '" data-price="' + opt.price + '" /> ' + opt.name + ' (+' + formatPrice(opt.price) + ')';
        label.querySelector('input').addEventListener('change', function () {
          if (this.checked) selected.push(opt.id);
          else selected = selected.filter(function (x) { return x !== opt.id; });
          price = getProductPrice(product, selected);
          priceEl.textContent = formatPrice(price);
        });
        optsList.appendChild(label);
      });
    }

    var addBtn = card.querySelector('.btn-add-to-cart');
    addBtn.addEventListener('click', function () {
      var finalPrice = product.variative ? getProductPrice(product, selected) : product.price;
      var productId = product.variative ? getProductIdWithOptions(product, selected) : product.id;
      var options = product.variative && selected.length ? { selected: selected } : undefined;
      if (window.addToCart) {
        window.addToCart({
          productId: productId,
          name: product.name + (options ? ' (' + selected.map(function (o) {
            var x = product.options.find(function (p) { return p.id === o; });
            return x ? x.name : o;
          }).join(', ') + ')' : ''),
          price: finalPrice,
          image: product.image,
          options: options
        });
      }
    });

    container.appendChild(card);
  }

  function filterProducts(list) {
    return list.filter(function (p) {
      if (currentFilter === 'all') { }
      else if (currentFilter === 'bots' && p.category !== 'bots') return false;
      else if (currentFilter === 'sites' && p.category !== 'sites') return false;
      if (currentPriceFilter === 'cheap' && p.price >= 20000) return false;
      if (currentPriceFilter === 'expensive' && p.price < 20000) return false;
      return true;
    });
  }

  function renderProducts() {
    var grid = document.getElementById('products-grid');
    if (!grid) return;
    grid.innerHTML = '';
    var filtered = filterProducts(products);
    filtered.forEach(function (p) {
      renderProductCard(p, grid);
    });
  }

  function initFilters() {
    document.querySelectorAll('.filter-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var filter = this.dataset.filter;
        document.querySelectorAll('.filter-btn').forEach(function (b) { b.classList.remove('active'); });
        this.classList.add('active');
        if (filter === 'all' || filter === 'bots' || filter === 'sites') {
          currentFilter = filter;
          currentPriceFilter = null;
        } else {
          currentPriceFilter = filter;
          currentFilter = 'all';
        }
        renderProducts();
      });
    });
  }

  window.openProductModal = function (product) {
    var modal = document.getElementById('product-modal');
    var body = document.getElementById('product-modal-body');
    if (!modal || !body) return;
    var price = getProductPrice(product, null);
    body.innerHTML =
      '<div class="product-modal-image"><img src="' + product.image + '" alt="' + product.name + '" /></div>' +
      '<h3 class="popup-title">' + product.name + '</h3>' +
      '<p class="product-modal-article">Артикул: ' + product.article + '</p>' +
      '<p class="popup-message">' + product.description + '</p>' +
      (product.variative
        ? '<div class="product-modal-options"><p>Доступные опции:</p><ul>' +
        product.options.map(function (o) { return '<li>' + o.name + ' — +' + formatPrice(o.price) + '</li>'; }).join('') +
        '</ul><p class="product-modal-price">Базовая цена: ' + formatPrice(product.basePrice || product.price) + '</p></div>'
        : '<p class="product-modal-price">' + formatPrice(price) + '</p>');
    modal.classList.add('active');
  };

  document.addEventListener('DOMContentLoaded', function () {
    renderProducts();
    initFilters();

    var modal = document.getElementById('product-modal');
    if (modal) {
      var closeBtn = modal.querySelector('.modal-close');
      if (closeBtn) closeBtn.addEventListener('click', function () { modal.classList.remove('active'); });
      modal.addEventListener('click', function (e) {
        if (e.target === modal) modal.classList.remove('active');
      });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && modal.classList.contains('active')) {
          modal.classList.remove('active');
        }
      });
    }
  });
})();
