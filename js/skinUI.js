/*
 * skinUI.js
 * The "Skins" panel: pick a card pack, upload your own, delete uploads,
 * and export/import the cookie-stored settings.
 *
 * The markup is injected at runtime so BlackJack.html stays as it was.
 */
(function (global) {
  'use strict';

  var panel, listEl, statusEl, nameInput, fileInput;

  function el(tag, attrs, html) {
    var node = document.createElement(tag);
    for (var k in attrs) node.setAttribute(k, attrs[k]);
    if (html !== undefined) node.innerHTML = html;
    return node;
  }

  function say(message, isError) {
    if (!statusEl) return;
    statusEl.textContent = message || '';
    statusEl.className = 'skin-status' + (isError ? ' skin-status-error' : '');
  }

  /* ---- pack list ---------------------------------------------------- */

  function renderList() {
    listEl.innerHTML = '';
    global.Skins.list().forEach(function (pack) {
      var row = el('div', { class: 'skin-row' + (pack.id === global.Skins.active() ? ' skin-row-active' : '') });

      var preview = el('div', { class: 'skin-preview' });
      ['AS', '0H', 'back'].forEach(function (code) {
        var img = el('img', { alt: code });
        img.src = global.Skins.srcFor(pack.id, code);
        preview.appendChild(img);
      });

      var label = el('button', { class: 'skin-pick', type: 'button' }, pack.name);
      label.addEventListener('click', function () {
        global.Skins.setActive(pack.id);
        renderList();
        say('Skin set to ' + pack.name + '.');
      });

      row.appendChild(preview);
      row.appendChild(label);

      if (!pack.builtIn) {
        var del = el('button', { class: 'skin-delete', type: 'button', title: 'Delete this pack' }, '&times;');
        del.addEventListener('click', function () {
          global.Skins.deletePack(pack.id).then(function () {
            renderList();
            say('Deleted ' + pack.name + '.');
          }).catch(function (err) { say(err.message, true); });
        });
        row.appendChild(del);
      }

      listEl.appendChild(row);
    });
  }

  /* ---- uploads ------------------------------------------------------ */

  function readFiles(files) {
    var images = {};
    var skipped = [];
    var jobs = [];

    Array.prototype.forEach.call(files, function (file) {
      if (!/^image\//.test(file.type)) { skipped.push(file.name); return; }
      var code = global.SkinName.toCardCode(file.webkitRelativePath || file.name);
      if (!code) { skipped.push(file.name); return; }
      images[code] = file;   // Blobs are stored directly in IndexedDB
      jobs.push(code);
    });

    return { images: images, count: jobs.length, skipped: skipped };
  }

  function handleUpload() {
    var files = fileInput.files;
    if (!files || !files.length) return say('Choose some card images first.', true);

    var parsed = readFiles(files);
    if (!parsed.count) {
      return say('No card images recognised. Name files like AS.png, 10H.png or ace_of_spades.png.', true);
    }

    var name = (nameInput.value || '').trim() || 'My pack';
    var id = 'user-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Date.now().toString(36);

    global.Skins.savePack(id, name, parsed.images).then(function () {
      global.Skins.setActive(id);
      renderList();
      fileInput.value = '';
      nameInput.value = '';
      var msg = 'Saved "' + name + '" with ' + parsed.count + ' card image' + (parsed.count === 1 ? '' : 's') + '.';
      if (parsed.count < 53) msg += ' Missing faces fall back to the classic deck.';
      if (parsed.skipped.length) msg += ' Ignored ' + parsed.skipped.length + ' unrecognised file(s).';
      say(msg);
    }).catch(function (err) {
      say('Could not save pack: ' + err.message, true);
    });
  }

  /* ---- settings export / import ------------------------------------- */

  function exportSettings() {
    var blob = new Blob([global.CookieStore.toJSON()], { type: 'application/json' });
    var a = el('a', { download: 'card-counting-settings.json' });
    a.href = URL.createObjectURL(blob);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    say('Settings exported.');
  }

  function importSettings(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        global.CookieStore.fromJSON(String(reader.result));
        say('Settings imported. Reloading…');
        setTimeout(function () { location.reload(); }, 600);
      } catch (err) {
        say('That file is not a settings export: ' + err.message, true);
      }
    };
    reader.readAsText(file);
  }

  /* ---- panel -------------------------------------------------------- */

  function build() {
    var toggle = el('button', { id: 'skinToggle', type: 'button', title: 'Card skins & settings' }, 'Skins');
    panel = el('div', { id: 'skinPanel', class: 'skin-hidden' });

    panel.appendChild(el('h2', { class: 'skin-title' }, 'Card skins'));
    listEl = el('div', { id: 'skinList' });
    panel.appendChild(listEl);

    var upload = el('div', { class: 'skin-upload' });
    upload.appendChild(el('h3', { class: 'skin-subtitle' }, 'Upload a pack'));
    upload.appendChild(el('p', { class: 'skin-hint' },
      'Pick up to 53 images named <code>AS.png</code>, <code>10H.png</code>, ' +
      '<code>ace_of_spades.png</code> … plus <code>back.png</code>. ' +
      'Packs are stored in this browser.'));

    nameInput = el('input', { type: 'text', id: 'skinName', placeholder: 'Pack name' });
    fileInput = el('input', { type: 'file', id: 'skinFiles', multiple: 'multiple', accept: 'image/*' });
    var saveBtn = el('button', { type: 'button', class: 'skin-action' }, 'Save pack');
    saveBtn.addEventListener('click', handleUpload);

    upload.appendChild(nameInput);
    upload.appendChild(fileInput);
    upload.appendChild(saveBtn);
    panel.appendChild(upload);

    var settings = el('div', { class: 'skin-settings' });
    settings.appendChild(el('h3', { class: 'skin-subtitle' }, 'Settings'));
    settings.appendChild(el('p', { class: 'skin-hint' },
      'Strategy tables, deviations, bet spreads, house rules and bankroll are saved to cookies automatically when you hit <b>Save Changes</b>.'));

    var exportBtn = el('button', { type: 'button', class: 'skin-action' }, 'Export settings');
    exportBtn.addEventListener('click', exportSettings);
    var importLabel = el('label', { class: 'skin-action skin-import' }, 'Import settings');
    var importInput = el('input', { type: 'file', accept: 'application/json,.json' });
    importInput.style.display = 'none';
    importInput.addEventListener('change', function () {
      if (importInput.files && importInput.files[0]) importSettings(importInput.files[0]);
    });
    importLabel.appendChild(importInput);

    settings.appendChild(exportBtn);
    settings.appendChild(importLabel);
    panel.appendChild(settings);

    statusEl = el('p', { class: 'skin-status' });
    panel.appendChild(statusEl);

    if (global.CookieStore && !global.CookieStore.usingCookies()) {
      say('Cookies are blocked here (this page is probably opened from a file:// path), so settings fall back to local storage. Serve the folder over http to use cookies.', true);
    }

    toggle.addEventListener('click', function () {
      panel.classList.toggle('skin-hidden');
    });

    document.body.appendChild(toggle);
    document.body.appendChild(panel);
    renderList();
  }

  function init() {
    if (!global.Skins) return console.warn('[skinUI] Skins not loaded');
    build();
    global.Skins.ready.then(renderList);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(window);
