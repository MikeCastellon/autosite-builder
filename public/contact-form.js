/* Contact / inquiry form widget — injects a general inquiry form into the
   site's #contact section. Free for all sites; posts to create-inquiry. */
(function () {
  'use strict';

  var script = document.currentScript || (function () {
    var s = document.getElementsByTagName('script');
    return s[s.length - 1];
  })();
  var siteId = script && script.getAttribute('data-site-id');
  var accent = (script && script.getAttribute('data-accent')) || '#1a1a1a';
  if (!siteId) return;

  var API = script.src.replace(/\/contact-form\.js.*$/, '');

  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else { fn(); }
  }

  ready(function () {
    if (document.querySelector('[data-acg-inquiry]')) return; // guard double-inject

    var host = document.querySelector('#contact');
    if (!host) {
      // Fallback: insert a new section before the last footer (or at body end).
      host = document.createElement('section');
      var footers = document.querySelectorAll('footer');
      if (footers.length) {
        footers[footers.length - 1].parentNode.insertBefore(host, footers[footers.length - 1]);
      } else {
        document.body.appendChild(host);
      }
    }

    var wrap = document.createElement('div');
    wrap.setAttribute('data-acg-inquiry', '');
    wrap.style.cssText = 'max-width:520px;margin:32px auto 0;padding:0 16px;font-family:inherit;';
    wrap.innerHTML = formHtml(accent);
    host.appendChild(wrap);

    var form = wrap.querySelector('form');
    var status = wrap.querySelector('[data-acg-status]');

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      status.textContent = '';
      // Use form.elements[...] — NOT form.name, which resolves to the form's
      // own `name` IDL attribute instead of the input named "name".
      var name = form.elements['name'].value.trim();
      var email = form.elements['email'].value.trim();
      var phone = form.elements['phone'].value.trim();
      var message = form.elements['message'].value.trim();
      var website = form.elements['website'].value; // honeypot

      if (!name || !email || !message) {
        status.style.color = '#cc0000';
        status.textContent = 'Please fill in your name, email, and message.';
        return;
      }

      var btn = form.querySelector('button[type="submit"]');
      btn.disabled = true;
      var prevLabel = btn.textContent;
      btn.textContent = 'Sending…';

      fetch(API + '/.netlify/functions/create-inquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId: siteId, name: name, email: email, phone: phone, message: message, website: website }),
      })
        .then(function (r) { return r.json().then(function (b) { return { ok: r.ok, b: b }; }); })
        .then(function (res) {
          if (res.ok && res.b && res.b.ok) {
            wrap.innerHTML = successHtml(accent);
          } else {
            btn.disabled = false;
            btn.textContent = prevLabel;
            status.style.color = '#cc0000';
            status.textContent = (res.b && res.b.error) ? res.b.error : 'Something went wrong. Please try again.';
          }
        })
        .catch(function () {
          btn.disabled = false;
          btn.textContent = prevLabel;
          status.style.color = '#cc0000';
          status.textContent = 'Network error. Please try again.';
        });
    });
  });

  function fieldCss() {
    return 'width:100%;box-sizing:border-box;padding:12px 14px;margin-bottom:12px;border:1px solid rgba(0,0,0,0.15);border-radius:10px;font-size:15px;font-family:inherit;background:#fff;color:#1a1a1a;';
  }

  function formHtml(accent) {
    return ''
      + '<h3 style="font-size:1.4rem;font-weight:700;margin:0 0 16px;color:inherit;">Send us a message</h3>'
      + '<form novalidate>'
      + '<input name="name" type="text" placeholder="Your name" autocomplete="name" style="' + fieldCss() + '" />'
      + '<input name="email" type="email" placeholder="Email address" autocomplete="email" style="' + fieldCss() + '" />'
      + '<input name="phone" type="tel" placeholder="Phone (optional)" autocomplete="tel" style="' + fieldCss() + '" />'
      + '<textarea name="message" rows="4" placeholder="How can we help?" style="' + fieldCss() + 'resize:vertical;"></textarea>'
      + '<input name="website" type="text" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px;width:1px;height:1px;opacity:0;" />'
      + '<button type="submit" style="width:100%;padding:13px 16px;border:0;border-radius:10px;background:' + accent + ';color:#fff;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit;">Send message</button>'
      + '<p data-acg-status role="status" style="margin:10px 0 0;font-size:13px;min-height:16px;"></p>'
      + '</form>';
  }

  function successHtml(accent) {
    return ''
      + '<div style="text-align:center;padding:28px 16px;border:1px solid rgba(0,0,0,0.1);border-radius:12px;background:#fff;">'
      + '<div style="width:44px;height:44px;border-radius:50%;background:' + accent + ';color:#fff;display:flex;align-items:center;justify-content:center;margin:0 auto 12px;font-size:22px;">✓</div>'
      + '<h3 style="margin:0 0 6px;font-size:1.2rem;font-weight:700;color:#1a1a1a;">Thanks — we\'ll be in touch.</h3>'
      + '<p style="margin:0;color:#666;font-size:14px;">Your message has been sent.</p>'
      + '</div>';
  }
})();
