/* Scheduler widget v2 — multi-step (service → date+time → details → confirm). */
(function () {
  'use strict';

  var script = document.currentScript || (function () {
    var s = document.getElementsByTagName('script');
    return s[s.length - 1];
  })();
  var siteId = script && script.getAttribute('data-site-id');
  var previewMode = script && script.getAttribute('data-preview-mode') === 'true';
  if (!siteId) return;

  var API = script.src.replace(/\/scheduler\.js.*$/, '');

  fetch(API + '/.netlify/functions/scheduler-config?siteId=' + encodeURIComponent(siteId))
    .then(function (r) { return r.ok ? r.json() : { enabled: false }; })
    .catch(function () { return { enabled: false }; })
    .then(function (cfg) {
      if (!cfg || !cfg.enabled) return;
      if (previewMode) openModal(cfg, { inline: true });
      else mountButton(cfg);
    });

  function mountButton(cfg) {
    var brand = cfg.brandColor || '#1a1a1a';
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = cfg.button_label || 'Book Now';
    btn.setAttribute('aria-label', 'Open booking form');
    btn.style.cssText =
      'position:fixed;right:20px;bottom:72px;z-index:9998;padding:14px 22px;' +
      'background:' + brand + ';color:#fff;border:0;border-radius:999px;' +
      'font:600 14px/1 Inter,system-ui,sans-serif;cursor:pointer;' +
      'box-shadow:0 10px 30px rgba(0,0,0,0.18);';
    btn.addEventListener('click', function () { openModal(cfg, { inline: false }); });
    document.body.appendChild(btn);

    document.querySelectorAll('[data-scheduler-trigger]').forEach(function (el) {
      el.addEventListener('click', function (e) { e.preventDefault(); openModal(cfg, { inline: false }); });
    });
  }

  function openModal(cfg, opts) {
    if (document.getElementById('acg-scheduler-modal')) return;
    var brand = cfg.brandColor || '#1a1a1a';

    var container, card;
    if (opts.inline) {
      container = document.createElement('div');
      container.id = 'acg-scheduler-modal';
      container.style.cssText = 'font-family:Inter,system-ui,sans-serif;';
      card = document.createElement('div');
      card.style.cssText = 'background:#fff;border:1px solid #eee;border-radius:12px;max-width:520px;padding:24px;';
      container.appendChild(card);
      var host = document.getElementById('acg-scheduler-preview-host') || document.body;
      host.innerHTML = '';
      host.appendChild(container);
    } else {
      container = document.createElement('div');
      container.id = 'acg-scheduler-modal';
      container.setAttribute('role', 'dialog');
      container.setAttribute('aria-modal', 'true');
      container.style.cssText =
        'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;' +
        'display:flex;align-items:center;justify-content:center;padding:16px;' +
        'font-family:Inter,system-ui,sans-serif;';
      card = document.createElement('div');
      card.style.cssText =
        'background:#fff;border-radius:14px;max-width:520px;width:100%;' +
        'max-height:90vh;overflow:auto;padding:28px;box-shadow:0 20px 60px rgba(0,0,0,0.3);';
      container.appendChild(card);
      document.body.appendChild(container);
      container.addEventListener('click', function (e) { if (e.target === container) close(); });
      document.addEventListener('keydown', function onKey(e) {
        if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onKey); }
      });
    }

    var state = {
      service: cfg.services && cfg.services.length === 1 ? cfg.services[0] : null,
      dateISO: null,
      slotISO: null,
      details: {},
      step: null,
    };

    function close() { container.remove(); }

    function header(title, stepLabel) {
      return '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:8px;">' +
        '<div><h2 style="margin:0;font-size:20px;font-weight:800;color:#111;">' + esc(title) + '</h2>' +
        (stepLabel ? '<div style="color:#888;font-size:12px;margin-top:4px;">' + esc(stepLabel) + '</div>' : '') +
        '</div>' +
        (opts.inline ? '' : '<button type="button" data-close aria-label="Close" style="background:none;border:0;font-size:24px;line-height:1;cursor:pointer;color:#888;">×</button>') +
      '</div>';
    }

    function render() {
      var enabledServices = (cfg.services || []).filter(function (s) { return s.enabled !== false; });
      if (!state.service && enabledServices.length > 1) return renderServices(enabledServices);
      if (!state.dateISO || !state.slotISO) return renderDateTime();
      if (!state.details.submitted) return renderDetails();
      return renderSuccess();
    }

    function renderServices(services) {
      var items = services.map(function (s) {
        return '<button type="button" data-svc="' + esc(s.id) + '" style="display:block;width:100%;text-align:left;padding:14px;margin-bottom:8px;border:1px solid #eee;border-radius:10px;background:#fff;cursor:pointer;">' +
          '<div style="font-weight:700;color:#111;">' + esc(s.name) + '</div>' +
          '<div style="font-size:13px;color:#666;margin-top:2px;">' + esc(s.duration_minutes) + ' min' + (s.price ? ' · ' + esc(s.price) : '') + '</div>' +
          (s.description ? '<div style="font-size:12px;color:#888;margin-top:4px;">' + esc(s.description) + '</div>' : '') +
        '</button>';
      }).join('');
      card.innerHTML = header('Pick a service', 'Step 1 of 3') +
        '<p style="margin:0 0 12px 0;color:#555;font-size:13px;">' + esc(cfg.welcome_text || '') + '</p>' +
        items;
      wireClose();
      card.querySelectorAll('[data-svc]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          state.service = services.find(function (s) { return s.id === btn.getAttribute('data-svc'); });
          render();
        });
      });
    }

    function renderDateTime() {
      var stepLabel = state.service && cfg.services && cfg.services.length > 1 ? 'Step 2 of 3' : 'Step 1 of 2';
      card.innerHTML = header('Pick a date and time', stepLabel) +
        '<p style="margin:0 0 8px 0;color:#666;font-size:13px;">' + esc(state.service ? state.service.name + ' · ' + state.service.duration_minutes + ' min' : '') + '</p>' +
        '<div id="acg-cal" style="margin-bottom:12px;"></div>' +
        '<div id="acg-slots" style="display:flex;flex-wrap:wrap;gap:6px;min-height:32px;"></div>' +
        (state.service && cfg.services && cfg.services.length > 1
          ? '<button type="button" data-back style="margin-top:16px;background:none;border:0;color:#888;cursor:pointer;font-size:13px;">← Back</button>'
          : '');
      wireClose();
      renderCalendar(card.querySelector('#acg-cal'));
      var backBtn = card.querySelector('[data-back]');
      if (backBtn) backBtn.addEventListener('click', function () { state.service = null; state.dateISO = null; state.slotISO = null; render(); });
    }

    function renderCalendar(host) {
      var cursor = state.cursorMonth || monthStart(new Date());
      state.cursorMonth = cursor;
      var rows = monthGrid(cursor);
      var label = cursor.toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
      host.innerHTML =
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">' +
          '<div style="font-weight:600;">' + esc(label) + '</div>' +
          '<div><button type="button" data-prev style="background:none;border:0;padding:4px 8px;cursor:pointer;">‹</button>' +
          '<button type="button" data-next style="background:none;border:0;padding:4px 8px;cursor:pointer;">›</button></div>' +
        '</div>' +
        '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;font-size:12px;">' +
          ['S','M','T','W','T','F','S'].map(function (d) { return '<div style="text-align:center;color:#888;padding:4px 0;">' + d + '</div>'; }).join('') +
          rows.map(function (day) {
            var iso = day.iso;
            var weekday = day.weekday;
            var availabilityForDay = (cfg.availability || {})[weekday] || [];
            var isPast = day.past || (availabilityForDay.length === 0);
            var isCurrent = day.iso === state.dateISO;
            return '<button type="button" data-day="' + iso + '" ' + (isPast || !day.inMonth ? 'disabled' : '') + ' style="padding:8px 0;border:1px solid #eee;background:' + (isCurrent ? '#1a1a1a' : '#fff') + ';color:' + (isCurrent ? '#fff' : (isPast || !day.inMonth ? '#ccc' : '#111')) + ';border-radius:6px;cursor:' + (isPast || !day.inMonth ? 'default' : 'pointer') + ';font-size:12px;">' + day.dayNum + '</button>';
          }).join('') +
        '</div>';

      host.querySelector('[data-prev]').addEventListener('click', function () { state.cursorMonth = addMonths(cursor, -1); renderDateTime(); });
      host.querySelector('[data-next]').addEventListener('click', function () { state.cursorMonth = addMonths(cursor, 1); renderDateTime(); });
      host.querySelectorAll('[data-day]:not([disabled])').forEach(function (b) {
        b.addEventListener('click', function () {
          state.dateISO = b.getAttribute('data-day');
          state.slotISO = null;
          renderDateTime();
          loadSlots();
        });
      });
      if (state.dateISO) loadSlots();
    }

    function loadSlots() {
      var slotsHost = card.querySelector('#acg-slots');
      slotsHost.innerHTML = '<div style="color:#888;font-size:13px;">Loading…</div>';
      var url = API + '/.netlify/functions/scheduler-slots?siteId=' + encodeURIComponent(siteId) +
        '&date=' + encodeURIComponent(state.dateISO) +
        (state.service ? '&serviceId=' + encodeURIComponent(state.service.id) : '');
      fetch(url).then(function (r) { return r.json(); }).then(function (res) {
        if (!res.slots || res.slots.length === 0) {
          slotsHost.innerHTML = '<div style="color:#888;font-size:13px;">No times available — try another day.</div>';
          return;
        }
        slotsHost.innerHTML = res.slots.map(function (iso) {
          var t = new Date(iso);
          var label = t.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' });
          return '<button type="button" data-slot="' + iso + '" style="padding:8px 12px;border:1px solid #ccc;background:#fff;border-radius:6px;cursor:pointer;font-size:13px;">' + label + '</button>';
        }).join('');
        slotsHost.querySelectorAll('[data-slot]').forEach(function (b) {
          b.addEventListener('click', function () {
            state.slotISO = b.getAttribute('data-slot');
            render();
          });
        });
      });
    }

    function renderDetails() {
      var stepLabel = cfg.services && cfg.services.length > 1 ? 'Step 3 of 3' : 'Step 2 of 2';
      var whenLabel = new Date(state.slotISO).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'UTC' });
      card.innerHTML = header('Your details', stepLabel) +
        '<div style="color:#666;font-size:13px;margin-bottom:16px;">' + esc((state.service ? state.service.name + ' · ' : '') + whenLabel) + '</div>' +
        '<form id="acg-booking-form" novalidate>' +
          field('customer_name', 'Name', 'text', true) +
          field('customer_email', 'Email', 'email', true) +
          field('customer_phone', 'Phone', 'tel', true) +
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
          '<input type="text" name="website" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px;" aria-hidden="true" />' +
          '<div id="acg-form-error" style="color:#c00;font-size:13px;margin:8px 0;display:none;"></div>' +
          '<div style="display:flex;gap:8px;margin-top:12px;">' +
            '<button type="button" data-back style="padding:12px 14px;background:#fff;border:1px solid #ccc;border-radius:10px;font:600 14px Inter;cursor:pointer;">Back</button>' +
            '<button type="submit" style="flex:1;padding:14px;background:' + brand + ';color:#fff;border:0;border-radius:10px;font:600 15px Inter;cursor:pointer;">Submit request</button>' +
          '</div>' +
        '</form>';
      wireClose();
      card.querySelector('[data-back]').addEventListener('click', function () { state.slotISO = null; render(); });
      card.querySelector('#acg-booking-form').addEventListener('submit', function (e) { e.preventDefault(); submit(); });
    }

    function renderSuccess() {
      card.innerHTML = header('Thanks!', '') +
        '<p style="color:#555;font-size:14px;">' + esc((cfg.businessName || 'We') + ' will email you to confirm shortly.') + '</p>';
      wireClose();
    }

    function submit() {
      var form = card.querySelector('#acg-booking-form');
      var errBox = card.querySelector('#acg-form-error');
      errBox.style.display = 'none';
      var data = Object.fromEntries(new FormData(form).entries());
      var payload = {
        siteId: siteId,
        customer_name: data.customer_name,
        customer_email: data.customer_email,
        customer_phone: data.customer_phone,
        preferred_at: state.slotISO,
        vehicle_make: data.vehicle_make,
        vehicle_model: data.vehicle_model,
        vehicle_year: Number(data.vehicle_year),
        vehicle_size: data.vehicle_size,
        service_address: data.service_address || undefined,
        notes: data.notes || undefined,
        referral_source: data.referral_source || undefined,
        website: data.website || undefined,
        service_id: state.service ? state.service.id : undefined,
      };
      var submitBtn = form.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Submitting…';
      fetch(API + '/.netlify/functions/create-booking', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
        .then(function (res) {
          if (res.ok) { state.details.submitted = true; render(); }
          else {
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

    function wireClose() {
      var b = card.querySelector('[data-close]');
      if (b) b.addEventListener('click', close);
    }

    function esc(s) {
      return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
    }

    function field(name, label, type, required, extra) {
      return '<label style="display:block;margin-bottom:10px;font-size:12px;color:#555;">' +
        label + (required ? ' <span style="color:#c00">*</span>' : '') +
        '<input type="' + type + '" name="' + name + '"' + (required ? ' required' : '') + ' ' + (extra || '') +
          ' style="width:100%;margin-top:3px;padding:8px 10px;border:1px solid #ddd;border-radius:6px;font:13px Inter;" />' +
        '</label>';
    }
    function fieldTextarea(name, label) {
      return '<label style="display:block;margin-bottom:10px;font-size:12px;color:#555;">' + label +
        '<textarea name="' + name + '" rows="2" style="width:100%;margin-top:3px;padding:8px 10px;border:1px solid #ddd;border-radius:6px;font:13px Inter;"></textarea>' +
        '</label>';
    }
    function select(name, label, options) {
      var opts = options.map(function (o) { return '<option value="' + o + '">' + o + '</option>'; }).join('');
      return '<label style="display:block;margin-bottom:10px;font-size:12px;color:#555;">' + label + ' <span style="color:#c00">*</span>' +
        '<select name="' + name + '" required style="width:100%;margin-top:3px;padding:8px 10px;border:1px solid #ddd;border-radius:6px;font:13px Inter;background:#fff;">' + opts + '</select></label>';
    }
    function row(a, b) {
      return '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">' + a + b + '</div>';
    }

    render();
  }

  function monthStart(d) { var x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)); return x; }
  function addMonths(d, n) { return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1)); }
  function isoDay(d) { return d.toISOString().slice(0, 10); }
  function monthGrid(cursor) {
    var first = monthStart(cursor);
    var gridStart = new Date(first); gridStart.setUTCDate(first.getUTCDate() - first.getUTCDay());
    var out = [];
    var today = new Date(); today.setUTCHours(0, 0, 0, 0);
    for (var i = 0; i < 42; i++) {
      var d = new Date(gridStart); d.setUTCDate(gridStart.getUTCDate() + i);
      out.push({
        iso: isoDay(d),
        dayNum: d.getUTCDate(),
        weekday: ['sun','mon','tue','wed','thu','fri','sat'][d.getUTCDay()],
        inMonth: d.getUTCMonth() === cursor.getUTCMonth(),
        past: d.getTime() < today.getTime(),
      });
    }
    return out;
  }
})();
