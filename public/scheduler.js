/* Scheduler widget — loaded on published static sites via:
   <script src="https://<app>/scheduler.js" data-site-id="<uuid>" defer></script> */
(function () {
  'use strict';

  var script = document.currentScript || (function () {
    var s = document.getElementsByTagName('script');
    return s[s.length - 1];
  })();
  var siteId = script && script.getAttribute('data-site-id');
  if (!siteId) return;

  var API = script.src.replace(/\/scheduler\.js.*$/, '');

  fetch(API + '/.netlify/functions/scheduler-config?siteId=' + encodeURIComponent(siteId))
    .then(function (r) { return r.ok ? r.json() : { enabled: false }; })
    .catch(function () { return { enabled: false }; })
    .then(function (cfg) {
      if (!cfg || !cfg.enabled) return;
      mount(cfg);
    });

  function mount(cfg) {
    var brand = cfg.brandColor || '#1a1a1a';
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = 'Book Now';
    btn.setAttribute('aria-label', 'Open booking form');
    btn.style.cssText =
      'position:fixed;right:20px;bottom:72px;z-index:9998;padding:14px 22px;' +
      'background:' + brand + ';color:#fff;border:0;border-radius:999px;' +
      'font:600 14px/1 Inter,system-ui,sans-serif;cursor:pointer;' +
      'box-shadow:0 10px 30px rgba(0,0,0,0.18);';
    btn.addEventListener('click', openModal);
    document.body.appendChild(btn);

    // Also bind any in-template triggers
    document.querySelectorAll('[data-scheduler-trigger]').forEach(function (el) {
      el.addEventListener('click', function (e) { e.preventDefault(); openModal(); });
    });

    function openModal() {
      if (document.getElementById('acg-scheduler-modal')) return;
      var overlay = document.createElement('div');
      overlay.id = 'acg-scheduler-modal';
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.style.cssText =
        'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;' +
        'display:flex;align-items:center;justify-content:center;padding:16px;' +
        'font-family:Inter,system-ui,sans-serif;';

      var card = document.createElement('div');
      card.style.cssText =
        'background:#fff;border-radius:14px;max-width:480px;width:100%;' +
        'max-height:90vh;overflow:auto;padding:28px;box-shadow:0 20px 60px rgba(0,0,0,0.3);';

      var today = new Date().toISOString().slice(0, 10);
      card.innerHTML =
        '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:8px;">' +
          '<h2 style="margin:0;font-size:22px;font-weight:800;color:#111;">Request a booking</h2>' +
          '<button type="button" data-close aria-label="Close" ' +
            'style="background:none;border:0;font-size:24px;line-height:1;cursor:pointer;color:#888;">×</button>' +
        '</div>' +
        '<p style="margin:0 0 20px 0;color:#666;font-size:13px;">' +
          (cfg.businessName ? cfg.businessName + ' will' : 'We will') +
          ' email you to confirm.</p>' +
        '<form id="acg-booking-form" novalidate>' +
          field('customer_name', 'Name', 'text', true) +
          field('customer_email', 'Email', 'email', true) +
          field('customer_phone', 'Phone', 'tel', true) +
          row(
            field('date', 'Date', 'date', true, 'min="' + today + '"'),
            field('time', 'Time', 'time', true)
          ) +
          row(
            field('vehicle_make', 'Make', 'text', true),
            field('vehicle_model', 'Model', 'text', true)
          ) +
          row(
            field('vehicle_year', 'Year', 'number', true, 'min="1900" max="2100"'),
            select('vehicle_size', 'Size', ['sedan','suv','truck','van','other'])
          ) +
          field('service_address', 'Service address (if mobile)', 'text', false) +
          fieldTextarea('notes', 'Notes', false) +
          field('referral_source', 'How did you hear about us?', 'text', false) +
          '<input type="text" name="website" tabindex="-1" autocomplete="off" ' +
            'style="position:absolute;left:-9999px;" aria-hidden="true" />' +
          '<div id="acg-form-error" style="color:#c00;font-size:13px;margin:8px 0;display:none;"></div>' +
          '<button type="submit" style="width:100%;margin-top:12px;padding:14px;background:' + brand +
            ';color:#fff;border:0;border-radius:10px;font:600 15px Inter;cursor:pointer;">' +
            'Submit request</button>' +
        '</form>' +
        '<div id="acg-booking-success" style="display:none;text-align:center;padding:20px 0;">' +
          '<h3 style="margin:0 0 8px 0;color:#111;">Thanks!</h3>' +
          '<p style="margin:0;color:#666;font-size:14px;">We emailed you a confirmation and will be in touch shortly.</p>' +
        '</div>';

      overlay.appendChild(card);
      document.body.appendChild(overlay);

      var lastFocus = document.activeElement;
      var firstInput = card.querySelector('input,select,textarea,button');
      if (firstInput) firstInput.focus();

      function close() {
        overlay.remove();
        if (lastFocus && lastFocus.focus) lastFocus.focus();
      }

      overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
      card.querySelector('[data-close]').addEventListener('click', close);
      document.addEventListener('keydown', function onKey(e) {
        if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onKey); }
      });

      card.querySelector('#acg-booking-form').addEventListener('submit', function (e) {
        e.preventDefault();
        submit(card);
      });
    }

    function submit(card) {
      var form = card.querySelector('#acg-booking-form');
      var errBox = card.querySelector('#acg-form-error');
      errBox.style.display = 'none';
      errBox.textContent = '';

      var data = Object.fromEntries(new FormData(form).entries());
      var preferred = data.date && data.time
        ? new Date(data.date + 'T' + data.time).toISOString()
        : null;

      var payload = {
        siteId: siteId,
        customer_name: data.customer_name,
        customer_email: data.customer_email,
        customer_phone: data.customer_phone,
        preferred_at: preferred,
        vehicle_make: data.vehicle_make,
        vehicle_model: data.vehicle_model,
        vehicle_year: Number(data.vehicle_year),
        vehicle_size: data.vehicle_size,
        service_address: data.service_address || undefined,
        notes: data.notes || undefined,
        referral_source: data.referral_source || undefined,
        website: data.website || undefined,
      };

      var submitBtn = form.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Submitting…';

      fetch(API + '/.netlify/functions/create-booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
        .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
        .then(function (res) {
          if (res.ok) {
            form.style.display = 'none';
            card.querySelector('#acg-booking-success').style.display = 'block';
          } else {
            errBox.textContent = (res.j && res.j.error) || 'Something went wrong. Please try again.';
            errBox.style.display = 'block';
            submitBtn.disabled = false;
            submitBtn.textContent = 'Submit request';
          }
        })
        .catch(function () {
          errBox.textContent = 'Network error. Please try again.';
          errBox.style.display = 'block';
          submitBtn.disabled = false;
          submitBtn.textContent = 'Submit request';
        });
    }

    function field(name, label, type, required, extra) {
      return '<label style="display:block;margin-bottom:12px;font-size:13px;color:#333;">' +
        label + (required ? ' <span style="color:#c00">*</span>' : '') +
        '<input type="' + type + '" name="' + name + '"' + (required ? ' required' : '') + ' ' + (extra || '') +
          ' style="width:100%;margin-top:4px;padding:10px 12px;border:1px solid #ddd;border-radius:8px;font:14px Inter;" />' +
        '</label>';
    }
    function fieldTextarea(name, label, required) {
      return '<label style="display:block;margin-bottom:12px;font-size:13px;color:#333;">' +
        label + (required ? ' <span style="color:#c00">*</span>' : '') +
        '<textarea name="' + name + '" rows="2" ' + (required ? 'required' : '') +
          ' style="width:100%;margin-top:4px;padding:10px 12px;border:1px solid #ddd;border-radius:8px;font:14px Inter;"></textarea>' +
        '</label>';
    }
    function select(name, label, options) {
      var opts = options.map(function (o) { return '<option value="' + o + '">' + o + '</option>'; }).join('');
      return '<label style="display:block;margin-bottom:12px;font-size:13px;color:#333;">' + label +
        ' <span style="color:#c00">*</span>' +
        '<select name="' + name + '" required ' +
          'style="width:100%;margin-top:4px;padding:10px 12px;border:1px solid #ddd;border-radius:8px;font:14px Inter;background:#fff;">' +
          opts + '</select></label>';
    }
    function row(a, b) {
      return '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">' + a + b + '</div>';
    }
  }
})();
