/* Scheduler widget v2 — multi-step (service → date+time → details → confirm). */
(function () {
  'use strict';

  var script = document.currentScript || (function () {
    var s = document.getElementsByTagName('script');
    return s[s.length - 1];
  })();
  var siteId = script && script.getAttribute('data-site-id');
  var previewMode = script && script.getAttribute('data-preview-mode') === 'true';
  var autoOpen = script && script.getAttribute('data-auto-open') === 'true';
  if (!siteId) return;

  var API = script.src.replace(/\/scheduler\.js.*$/, '');

  var cfgUrl = API + '/.netlify/functions/scheduler-config?siteId=' + encodeURIComponent(siteId);
  // In preview/auto-open mode (owner previewing their own settings), bypass
  // the browser cache so owners see their settings changes immediately.
  var fetchOpts = (previewMode || autoOpen) ? { cache: 'no-store' } : undefined;
  if (previewMode || autoOpen) cfgUrl += '&t=' + Date.now();

  fetch(cfgUrl, fetchOpts)
    .then(function (r) { return r.ok ? r.json() : { enabled: false }; })
    .catch(function () { return { enabled: false }; })
    .then(function (cfg) {
      if (!cfg || !cfg.enabled) return;
      if (previewMode) openModal(cfg, { inline: true });
      else if (autoOpen) openModal(cfg, { inline: false });
      else mountButton(cfg);
    });

  function mountButton(cfg) {
    var brand = cfg.brandColor || '#1a1a1a';
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Open booking form');
    btn.innerHTML =
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-3px;margin-right:8px;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>' +
      (cfg.button_label || 'Book Now');
    btn.style.cssText =
      'position:fixed;right:20px;bottom:72px;z-index:9998;padding:14px 22px;' +
      'background:' + brand + ';color:#fff;border:0;border-radius:999px;' +
      "font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;" +
      'font-weight:700;font-size:14px;line-height:1;letter-spacing:0.2px;cursor:pointer;' +
      'box-shadow:0 12px 36px rgba(0,0,0,0.22),0 2px 6px rgba(0,0,0,0.08);' +
      'display:inline-flex;align-items:center;transition:transform 0.15s,box-shadow 0.15s;';
    btn.addEventListener('mouseover', function () { btn.style.transform = 'translateY(-1px)'; btn.style.boxShadow = '0 16px 44px rgba(0,0,0,0.26),0 2px 8px rgba(0,0,0,0.1)'; });
    btn.addEventListener('mouseout', function () { btn.style.transform = 'translateY(0)'; btn.style.boxShadow = '0 12px 36px rgba(0,0,0,0.22),0 2px 6px rgba(0,0,0,0.08)'; });
    btn.addEventListener('click', function () { openModal(cfg, { inline: false }); });
    document.body.appendChild(btn);

    bindCtaTriggers(cfg);
  }

  function bindCtaTriggers(cfg) {
    // 1) Always honor explicit opt-in attribute.
    document.querySelectorAll('[data-scheduler-trigger]').forEach(function (el) {
      attachOpen(el, cfg);
    });

    // 2) If owner provided a CSS selector, it wins over auto-detect.
    var sel = (cfg.cta_selector || '').trim();
    if (sel) {
      try {
        document.querySelectorAll(sel).forEach(function (el) { attachOpen(el, cfg); });
      } catch (e) {
        // Invalid selector — fall through to auto-detect so the button still works.
        autoDetectBookNow(cfg);
      }
      return;
    }

    // 3) Default: scan for buttons/anchors whose text contains "book" (as a whole word).
    autoDetectBookNow(cfg);
  }

  function autoDetectBookNow(cfg) {
    var candidates = document.querySelectorAll('button, a');
    var re = /\bbook\b/i;
    candidates.forEach(function (el) {
      if (el.hasAttribute('data-scheduler-bound')) return;
      var text = (el.textContent || '').trim();
      if (re.test(text)) attachOpen(el, cfg);
    });
  }

  function attachOpen(el, cfg) {
    if (el.hasAttribute('data-scheduler-bound')) return;
    el.setAttribute('data-scheduler-bound', 'true');
    el.addEventListener('click', function (e) { e.preventDefault(); openModal(cfg, { inline: false }); });
  }

  function openModal(cfg, opts) {
    if (document.getElementById('acg-scheduler-modal')) return;
    var brand = cfg.brandColor || '#1a1a1a';
    var FONT = "Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif";

    var container, card;
    if (opts.inline) {
      container = document.createElement('div');
      container.id = 'acg-scheduler-modal';
      container.style.cssText = 'font-family:' + FONT + ';';
      card = document.createElement('div');
      card.style.cssText = 'background:#fff;border:1px solid rgba(0,0,0,0.07);border-radius:16px;max-width:760px;overflow:hidden;box-shadow:0 6px 24px rgba(0,0,0,0.04);';
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
        'position:fixed;inset:0;background:rgba(10,10,10,0.55);z-index:9999;' +
        'display:flex;align-items:center;justify-content:center;padding:16px;' +
        'backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);' +
        'font-family:' + FONT + ';';
      card = document.createElement('div');
      card.style.cssText =
        'background:#fff;border-radius:16px;max-width:760px;width:100%;' +
        'max-height:92vh;overflow:auto;box-shadow:0 20px 60px rgba(0,0,0,0.35);' +
        'overflow-x:hidden;';
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

    function brandBar() {
      // Top red-accent stripe (Pro Hub signature)
      return '<div style="height:4px;background:' + brand + ';"></div>';
    }

    function brandHeader() {
      var hasLogo = !!cfg.logo_url;
      var bizLine = esc(cfg.businessName || '') + (cfg.city ? ' <span style="color:#999;font-weight:400;"> · ' + esc(cfg.city) + '</span>' : '');
      return '<div style="padding:22px 28px 14px;display:flex;align-items:center;justify-content:space-between;gap:12px;border-bottom:1px solid #f0f0f0;">' +
        '<div style="display:flex;align-items:center;gap:12px;min-width:0;">' +
          (hasLogo
            ? '<img src="' + esc(cfg.logo_url) + '" alt="" style="height:40px;width:auto;max-width:160px;object-fit:contain;display:block;" />'
            : '<div style="width:40px;height:40px;border-radius:10px;background:' + brand + ';color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:16px;font-family:' + FONT + ';">' + esc((cfg.businessName || 'B').charAt(0).toUpperCase()) + '</div>') +
          '<div style="min-width:0;overflow:hidden;">' +
            '<div style="font-size:14px;font-weight:700;color:#1a1a1a;letter-spacing:-0.2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + bizLine + '</div>' +
            '<div style="font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:' + brand + ';font-weight:700;margin-top:2px;">Book an Appointment</div>' +
          '</div>' +
        '</div>' +
        (opts.inline ? '' : '<button type="button" data-close aria-label="Close" style="flex-shrink:0;background:#faf9f7;border:0;width:32px;height:32px;border-radius:50%;cursor:pointer;color:#666;font-size:18px;line-height:1;display:flex;align-items:center;justify-content:center;">×</button>') +
      '</div>';
    }

    function stepBar(currentStep, totalSteps) {
      if (!totalSteps || totalSteps < 2) return '';
      var dots = '';
      for (var i = 1; i <= totalSteps; i++) {
        var active = i <= currentStep;
        dots += '<div style="flex:1;height:3px;border-radius:2px;background:' + (active ? brand : '#eee') + ';"></div>';
      }
      return '<div style="display:flex;gap:4px;padding:0 28px 14px;">' + dots + '</div>';
    }

    function sectionTitle(title, subtitle) {
      return '<div style="padding:16px 28px 4px;">' +
        '<h2 style="margin:0;font-size:22px;font-weight:800;color:#1a1a1a;letter-spacing:-0.5px;line-height:1.2;">' + esc(title) + '</h2>' +
        (subtitle ? '<p style="margin:6px 0 0;color:#666;font-size:13px;line-height:1.5;">' + esc(subtitle) + '</p>' : '') +
      '</div>';
    }

    function bodyOpen() { return '<div style="padding:12px 28px 24px;">'; }
    function bodyClose() { return '</div>'; }

    function header(title, stepLabel) {
      // Back-compat shim: legacy helper retained only if called elsewhere.
      return '<div style="padding:18px 28px;">' +
        '<h2 style="margin:0;font-size:20px;font-weight:800;color:#1a1a1a;">' + esc(title) + '</h2>' +
        (stepLabel ? '<div style="color:#888;font-size:12px;margin-top:4px;">' + esc(stepLabel) + '</div>' : '') +
      '</div>';
    }

    function render() {
      var enabledServices = (cfg.services || []).filter(function (s) { return s.enabled !== false; });
      // Simple mode: skip service picker + calendar + slot picker entirely.
      if (cfg.booking_mode === 'simple') {
        if (!state.details.submitted) return renderSimpleForm(enabledServices);
        return renderSuccess();
      }
      if (!state.service && enabledServices.length > 1) return renderServices(enabledServices);
      if (!state.dateISO || !state.slotISO) return renderDateTime();
      if (!state.details.submitted) return renderDetails();
      return renderSuccess();
    }

    function renderSimpleForm(services) {
      var firstService = services && services.length > 0 ? services[0] : null;
      state.service = firstService;
      var serviceOptionsHtml = '';
      if (services && services.length > 1) {
        var opts = services.map(function (s) {
          return '<option value="' + esc(s.id) + '">' + esc(s.name) + (s.price ? ' · ' + esc(s.price) : '') + '</option>';
        }).join('');
        serviceOptionsHtml =
          '<label style="' + labelStyle() + '">Service <span style="color:' + brand + '">*</span>' +
            '<select name="service_id" required style="' + inputStyle() + 'appearance:none;-webkit-appearance:none;background-image:url(\'data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 12 12%22><path d=%22M2 4l4 4 4-4%22 stroke=%22%23888%22 stroke-width=%221.5%22 fill=%22none%22 stroke-linecap=%22round%22/></svg>\');background-repeat:no-repeat;background-position:right 12px center;background-size:12px;padding-right:36px;" onfocus="this.style.borderColor=\'' + brand + '\';" onblur="this.style.borderColor=\'#e2e2e2\';">' + opts + '</select>' +
          '</label>';
      }

      card.innerHTML = brandBar() + brandHeader() +
        sectionTitle('Request an appointment', cfg.welcome_text || '') +
        bodyOpen() +
          '<form id="acg-booking-form" novalidate>' +
            (serviceOptionsHtml ||
              (firstService ? '<input type="hidden" name="service_id" value="' + esc(firstService.id) + '" />' : '')) +
            row(
              field('customer_name', 'Name', 'text', true),
              field('customer_email', 'Email', 'email', true)
            ) +
            row(
              field('customer_phone', 'Phone', 'tel', true),
              field('preferred_time_text', 'Preferred time', 'text', true, 'placeholder="e.g. Next Tuesday afternoon"')
            ) +
            row3(
              field('vehicle_make', 'Make', 'text', true),
              field('vehicle_model', 'Model', 'text', true),
              field('vehicle_year', 'Year', 'number', true, 'min="1900" max="2100"')
            ) +
            row(
              select('vehicle_size', 'Size', [
                {value:'sedan', label:'Sedan'},
                {value:'suv', label:'SUV'},
                {value:'truck', label:'Truck'},
                {value:'van', label:'Van'},
                {value:'other', label:'Other'},
              ]),
              field('service_address', 'Service address (if mobile)', 'text', false)
            ) +
            fieldTextarea('notes', 'What can we help with?', false) +
            '<input type="text" name="website" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px;" aria-hidden="true" />' +
            '<div id="acg-form-error" style="color:' + brand + ';font-size:13px;margin:8px 0;display:none;font-weight:600;"></div>' +
            '<div style="display:flex;gap:10px;margin-top:16px;justify-content:flex-end;">' +
              '<button type="submit" style="padding:14px 32px;background:' + brand + ';color:#fff;border:0;border-radius:12px;font-family:' + FONT + ';font-weight:700;font-size:15px;cursor:pointer;letter-spacing:0.2px;">Send request</button>' +
            '</div>' +
          '</form>' +
        bodyClose();
      wireClose();
      card.querySelector('#acg-booking-form').addEventListener('submit', function (e) { e.preventDefault(); submitSimple(services); });
    }

    function submitSimple(services) {
      var form = card.querySelector('#acg-booking-form');
      var errBox = card.querySelector('#acg-form-error');
      errBox.style.display = 'none';
      var data = Object.fromEntries(new FormData(form).entries());

      // Resolve selected service if the user picked one from a dropdown.
      if (data.service_id && services) {
        state.service = services.find(function (s) { return s.id === data.service_id; }) || state.service;
      }

      // Simple mode has no slot — stash a far-future placeholder so the
      // validator passes, and prepend the user's free-text preferred time
      // to the notes so the owner sees it.
      var placeholderWhen = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      var preferredTimeText = (data.preferred_time_text || '').trim();
      var combinedNotes = (preferredTimeText ? 'Preferred time: ' + preferredTimeText + '\n\n' : '') + (data.notes || '');

      var payload = {
        siteId: siteId,
        customer_name: data.customer_name,
        customer_email: data.customer_email,
        customer_phone: data.customer_phone,
        preferred_at: placeholderWhen,
        vehicle_make: data.vehicle_make,
        vehicle_model: data.vehicle_model,
        vehicle_year: Number(data.vehicle_year),
        vehicle_size: data.vehicle_size,
        service_address: data.service_address || undefined,
        notes: combinedNotes || undefined,
        referral_source: undefined,
        website: data.website || undefined,
        service_id: state.service ? state.service.id : undefined,
        is_simple_request: true,
      };

      var submitBtn = form.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Sending…';

      if (previewMode || autoOpen) {
        setTimeout(function () { state.details.submitted = true; state.details.isPreview = true; render(); }, 300);
        return;
      }

      fetch(API + '/.netlify/functions/create-booking', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
        .then(function (res) {
          if (res.ok) { state.details.submitted = true; render(); }
          else {
            errBox.textContent = (res.j && res.j.error) || 'Something went wrong. Please try again.';
            errBox.style.display = 'block';
            submitBtn.disabled = false;
            submitBtn.textContent = 'Send request';
          }
        })
        .catch(function () {
          errBox.textContent = 'Network error. Please try again.';
          errBox.style.display = 'block';
          submitBtn.disabled = false;
          submitBtn.textContent = 'Send request';
        });
    }

    function renderServices(services) {
      var totalSteps = 3;
      var items = services.map(function (s) {
        return '<button type="button" data-svc="' + esc(s.id) + '" style="display:block;width:100%;text-align:left;padding:16px 18px;margin-bottom:10px;border:1px solid #e8e8e8;border-radius:12px;background:#fff;cursor:pointer;transition:all 0.15s ease;font-family:' + FONT + ';" onmouseover="this.style.borderColor=\'' + brand + '\';this.style.background=\'#fafafa\';" onmouseout="this.style.borderColor=\'#e8e8e8\';this.style.background=\'#fff\';">' +
          '<div style="display:flex;justify-content:space-between;align-items:baseline;gap:10px;">' +
            '<div style="font-weight:700;color:#1a1a1a;font-size:15px;letter-spacing:-0.2px;">' + esc(s.name) + '</div>' +
            (s.price ? '<div style="font-weight:700;color:' + brand + ';font-size:14px;white-space:nowrap;">' + esc(s.price) + '</div>' : '') +
          '</div>' +
          '<div style="font-size:12px;color:#999;margin-top:4px;letter-spacing:0.2px;">' + esc(s.duration_minutes) + ' min appointment</div>' +
          (s.description ? '<div style="font-size:13px;color:#666;margin-top:8px;line-height:1.5;">' + esc(s.description) + '</div>' : '') +
        '</button>';
      }).join('');
      card.innerHTML = brandBar() + brandHeader() + stepBar(1, totalSteps) +
        sectionTitle('Pick a service', cfg.welcome_text || '') +
        bodyOpen() + items + bodyClose();
      wireClose();
      card.querySelectorAll('[data-svc]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          state.service = services.find(function (s) { return s.id === btn.getAttribute('data-svc'); });
          render();
        });
      });
    }

    function renderDateTime() {
      var hasMultipleServices = cfg.services && cfg.services.length > 1;
      var totalSteps = hasMultipleServices ? 3 : 2;
      var currentStep = hasMultipleServices ? 2 : 1;
      var subtitle = state.service ? state.service.name + ' · ' + state.service.duration_minutes + ' min' : '';
      card.innerHTML = brandBar() + brandHeader() + stepBar(currentStep, totalSteps) +
        sectionTitle('Pick a date and time', subtitle) +
        bodyOpen() +
          '<div id="acg-cal" style="margin-bottom:14px;"></div>' +
          '<div id="acg-slots" style="display:flex;flex-wrap:wrap;gap:6px;min-height:32px;"></div>' +
          (state.service && hasMultipleServices
            ? '<button type="button" data-back style="margin-top:18px;background:none;border:0;color:#888;cursor:pointer;font-size:13px;font-weight:600;font-family:' + FONT + ';padding:0;">← Back</button>'
            : '') +
        bodyClose();
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
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">' +
          '<div style="font-weight:700;color:#1a1a1a;font-size:15px;letter-spacing:-0.2px;">' + esc(label) + '</div>' +
          '<div style="display:flex;gap:4px;">' +
            '<button type="button" data-prev aria-label="Previous month" style="background:#faf9f7;border:0;width:32px;height:32px;border-radius:8px;cursor:pointer;color:#555;font-size:16px;line-height:1;display:flex;align-items:center;justify-content:center;">‹</button>' +
            '<button type="button" data-next aria-label="Next month" style="background:#faf9f7;border:0;width:32px;height:32px;border-radius:8px;cursor:pointer;color:#555;font-size:16px;line-height:1;display:flex;align-items:center;justify-content:center;">›</button>' +
          '</div>' +
        '</div>' +
        '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:3px;font-size:12px;">' +
          ['S','M','T','W','T','F','S'].map(function (d) { return '<div style="text-align:center;color:#aaa;padding:4px 0;font-weight:600;letter-spacing:0.5px;">' + d + '</div>'; }).join('') +
          rows.map(function (day) {
            var iso = day.iso;
            var weekday = day.weekday;
            var availabilityForDay = (cfg.availability || {})[weekday] || [];
            var isPast = day.past || (availabilityForDay.length === 0);
            var isCurrent = day.iso === state.dateISO;
            var bg = isCurrent ? brand : '#fff';
            var color = isCurrent ? '#fff' : (isPast || !day.inMonth ? '#ccc' : '#1a1a1a');
            var borderColor = isCurrent ? brand : '#eee';
            return '<button type="button" data-day="' + iso + '" ' + (isPast || !day.inMonth ? 'disabled' : '') + ' style="padding:10px 0;border:1px solid ' + borderColor + ';background:' + bg + ';color:' + color + ';border-radius:8px;cursor:' + (isPast || !day.inMonth ? 'default' : 'pointer') + ';font-size:13px;font-weight:' + (isCurrent ? '700' : '500') + ';font-family:' + FONT + ';transition:all 0.1s;">' + day.dayNum + '</button>';
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
          slotsHost.innerHTML = '<div style="color:#888;font-size:13px;padding:16px 12px;background:#faf9f7;border-radius:10px;text-align:center;width:100%;">No times available — try another day.</div>';
          return;
        }
        slotsHost.innerHTML = res.slots.map(function (iso) {
          var t = new Date(iso);
          var label = t.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' });
          return '<button type="button" data-slot="' + iso + '" style="padding:10px 14px;border:1px solid #e2e2e2;background:#fff;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600;color:#1a1a1a;font-family:' + FONT + ';transition:all 0.15s;" onmouseover="this.style.borderColor=\'' + brand + '\';this.style.color=\'' + brand + '\';" onmouseout="this.style.borderColor=\'#e2e2e2\';this.style.color=\'#1a1a1a\';">' + label + '</button>';
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
      var hasMultipleServices = cfg.services && cfg.services.length > 1;
      var totalSteps = hasMultipleServices ? 3 : 2;
      var whenLabel = new Date(state.slotISO).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'UTC' });
      var subtitle = (state.service ? state.service.name + ' · ' : '') + whenLabel;
      card.innerHTML = brandBar() + brandHeader() + stepBar(totalSteps, totalSteps) +
        sectionTitle('Your details', subtitle) +
        bodyOpen() +
          '<form id="acg-booking-form" novalidate>' +
            // Row 1: Name | Email
            row(
              field('customer_name', 'Name', 'text', true),
              field('customer_email', 'Email', 'email', true)
            ) +
            // Row 2: Phone | Size
            row(
              field('customer_phone', 'Phone', 'tel', true),
              select('vehicle_size', 'Size', [
                {value:'sedan', label:'Sedan'},
                {value:'suv', label:'SUV'},
                {value:'truck', label:'Truck'},
                {value:'van', label:'Van'},
                {value:'other', label:'Other'},
              ])
            ) +
            // Row 3: Make | Model | Year (3-up)
            row3(
              field('vehicle_make', 'Make', 'text', true),
              field('vehicle_model', 'Model', 'text', true),
              field('vehicle_year', 'Year', 'number', true, 'min="1900" max="2100"')
            ) +
            // Row 4: Address | Referral
            row(
              field('service_address', 'Service address (if mobile)', 'text', false),
              field('referral_source', 'How did you hear about us?', 'text', false)
            ) +
            fieldTextarea('notes', 'Notes', false) +
            '<input type="text" name="website" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px;" aria-hidden="true" />' +
            '<div id="acg-form-error" style="color:' + brand + ';font-size:13px;margin:8px 0;display:none;font-weight:600;"></div>' +
            '<div style="display:flex;gap:10px;margin-top:16px;justify-content:flex-end;">' +
              '<button type="button" data-back style="padding:14px 22px;background:#fff;border:1px solid #ddd;border-radius:12px;font-family:' + FONT + ';font-weight:600;font-size:14px;cursor:pointer;color:#555;">Back</button>' +
              '<button type="submit" style="padding:14px 32px;background:' + brand + ';color:#fff;border:0;border-radius:12px;font-family:' + FONT + ';font-weight:700;font-size:15px;cursor:pointer;letter-spacing:0.2px;">Submit request</button>' +
            '</div>' +
          '</form>' +
        bodyClose();
      wireClose();
      card.querySelector('[data-back]').addEventListener('click', function () { state.slotISO = null; render(); });
      card.querySelector('#acg-booking-form').addEventListener('submit', function (e) { e.preventDefault(); submit(); });
    }

    function renderSuccess() {
      var previewNote = state.details.isPreview
        ? '<div style="margin-top:16px;padding:12px 14px;background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;color:#9a3412;font-size:12px;font-weight:600;">Preview only — no booking was created and no email was sent.</div>'
        : '';
      card.innerHTML = brandBar() + brandHeader() +
        '<div style="padding:48px 28px 36px;text-align:center;">' +
          '<div style="width:64px;height:64px;margin:0 auto 20px;background:' + brand + ';border-radius:50%;display:flex;align-items:center;justify-content:center;">' +
            '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>' +
          '</div>' +
          '<h2 style="margin:0 0 10px;font-size:24px;font-weight:800;color:#1a1a1a;letter-spacing:-0.5px;">Request received</h2>' +
          '<p style="margin:0;color:#666;font-size:14px;line-height:1.6;max-width:380px;margin:0 auto;">' + esc((cfg.businessName || 'We') + ' will email you shortly to confirm your appointment.') + '</p>' +
          previewNote +
        '</div>';
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

      // In preview mode, skip the real API call — no DB insert, no email.
      if (previewMode || autoOpen) {
        setTimeout(function () { state.details.submitted = true; state.details.isPreview = true; render(); }, 300);
        return;
      }

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

    function inputStyle() {
      return 'width:100%;margin-top:4px;padding:11px 13px;border:1px solid #e2e2e2;border-radius:10px;font-family:' + FONT + ';font-size:14px;color:#1a1a1a;background:#fff;box-sizing:border-box;outline:none;transition:border-color 0.15s;';
    }
    function labelStyle() {
      return 'display:block;margin-bottom:12px;font-size:12px;font-weight:600;color:#555;letter-spacing:0.2px;';
    }
    function field(name, label, type, required, extra) {
      return '<label style="' + labelStyle() + '">' +
        label + (required ? ' <span style="color:' + brand + '">*</span>' : '') +
        '<input type="' + type + '" name="' + name + '"' + (required ? ' required' : '') + ' ' + (extra || '') +
          ' style="' + inputStyle() + '" onfocus="this.style.borderColor=\'' + brand + '\';" onblur="this.style.borderColor=\'#e2e2e2\';" />' +
        '</label>';
    }
    function fieldTextarea(name, label) {
      return '<label style="' + labelStyle() + '">' + label +
        '<textarea name="' + name + '" rows="3" style="' + inputStyle() + 'resize:vertical;min-height:72px;" onfocus="this.style.borderColor=\'' + brand + '\';" onblur="this.style.borderColor=\'#e2e2e2\';"></textarea>' +
        '</label>';
    }
    function select(name, label, options) {
      var opts = options.map(function (o) {
        var value = typeof o === 'string' ? o : o.value;
        var display = typeof o === 'string' ? (o.charAt(0).toUpperCase() + o.slice(1)) : o.label;
        return '<option value="' + value + '">' + display + '</option>';
      }).join('');
      return '<label style="' + labelStyle() + '">' + label + ' <span style="color:' + brand + '">*</span>' +
        '<select name="' + name + '" required style="' + inputStyle() + 'appearance:none;-webkit-appearance:none;background-image:url(\'data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 12 12%22><path d=%22M2 4l4 4 4-4%22 stroke=%22%23888%22 stroke-width=%221.5%22 fill=%22none%22 stroke-linecap=%22round%22/></svg>\');background-repeat:no-repeat;background-position:right 12px center;background-size:12px;padding-right:36px;" onfocus="this.style.borderColor=\'' + brand + '\';" onblur="this.style.borderColor=\'#e2e2e2\';">' + opts + '</select></label>';
    }
    function row(a, b) {
      return '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">' + a + b + '</div>';
    }
    function row3(a, b, c) {
      return '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;">' + a + b + c + '</div>';
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
