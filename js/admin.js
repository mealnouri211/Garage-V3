/* Owner back office: overview, orders, schedule, customers, requests, services/prices, settings.
   Signs in with the owner username + password (see store.js). DEMO-LEVEL SECURITY: data lives in this browser. */
(() => {
  const HW = window.HW;
  const S = { tab: 'overview', range: '30', jobs: [], leads: [], users: [], owner: null, q: '', fStatus: '', fPaid: '', from: '', to: '', open: null, cust: null, svcQ: '', seen: null, quiet: false, err: '' };
  const ALL_STATUS = [...HW.STAGES, 'cancelled'];
  const PAY = ['knet', 'apple', 'deema', 'taly', 'cash'];
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const err = (ex) => HW.toast(HW.t('err_' + ((ex && ex.code) || 'generic')));
  const pname = (i) => { const p = HW.findProduct(i.pid); return p ? HW.L(p.name) : i.pid; };
  const sum = (a, f) => a.reduce((s, x) => s + f(x), 0);
  const live = (j) => j.status !== 'cancelled';
  const dayKey = (d) => { d = new Date(d); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const startOfDay = (d = new Date()) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
  const payName = (m) => HW.t('pay_' + (PAY.includes(m) ? m : 'cash') + '_v');
  const carTxt = (c) => esc(HW.carName(c, HW.lang));
  const stChip = (s) => `<span class="status status--${s}">${HW.t('st_' + s)}</span>`;
  const when = (d) => (d ? HW.fmtWhen(d) : '–');

  async function load() {
    S.jobs = await HW.api.listJobs({ all: true }); S.leads = await HW.api.listLeads(); S.users = await HW.api.listUsers(); S.owner = await HW.api.ownerInfo();
  }

  /* ---------- files: CSV ---------- */
  function csv(name, headers, rows) {
    const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const body = [headers, ...rows].map((r) => r.map(q).join(',')).join('\r\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + body], { type: 'text/csv;charset=utf-8' })); a.download = name; a.click();
  }
  const jobRow = (j) => [j.id, new Date(j.createdAt).toLocaleString('en-GB'), j.customer.name, '+' + j.customer.phone, HW.carName(j.car, 'en'), j.items.map((i) => (HW.findProduct(i.pid) ? HW.findProduct(i.pid).name.en : i.pid)).join(' + '),
    j.startFrom ? new Date(j.startFrom).toLocaleString('en-GB') : '', j.status, j.payment, j.paid ? 'paid' : 'unpaid', j.total.toFixed(3), j.internalNote || ''];
  const JOB_HEAD = ['Order', 'Created', 'Customer', 'Phone', 'Car', 'Services', 'Appointment', 'Status', 'Payment method', 'Payment', 'Total KD', 'Internal note'];

  /* ---------- gate ---------- */
  function gate(root) {
    root.innerHTML = `<form class="panel gate" id="ownerForm"><h2>${HW.t('a_login_t')}</h2><p class="muted">${HW.t('a_login_p')}</p>
      <div class="field"><label for="oUser">${HW.t('a_user')}</label><input id="oUser" autocomplete="username" dir="ltr" autocapitalize="none"></div>
      <div class="field"><label for="oPass">${HW.t('f_password')}</label><input id="oPass" type="password" autocomplete="current-password" dir="ltr"></div>
      <div class="err" id="oErr" role="alert"></div><button class="btn btn--gold btn--block">${HW.t('sign_in')}</button>
      ${HW.CONFIG.demoMode ? `<div class="demo-box"><b>${HW.t('demo_account')}</b><br><span dir="ltr">owner · owner1234</span></div>` : ''}
      <p class="muted small center"><a href="staff.html">${HW.t('a_staff_board')}</a></p></form>`;
    HW.$('#ownerForm').onsubmit = async (e) => {
      e.preventDefault();
      try { await HW.api.ownerLogin({ user: HW.$('#oUser').value, password: HW.$('#oPass').value }); await load(); S.seen = new Set(S.jobs.map((j) => j.id)); paint(); } catch (ex) { HW.$('#oErr').textContent = HW.t('err_' + (ex.code || 'generic')); }
    };
  }

  /* ---------- overview ---------- */
  const inRange = (j) => {
    if (S.range === 'all') return true;
    const from = S.range === 'today' ? startOfDay() : new Date(Date.now() - Number(S.range) * 86400000);
    return new Date(j.createdAt) >= from;
  };
  const tile = (value, label, cls = '') => `<div class="kpi ${cls}"><b>${value}</b><small>${label}</small></div>`;

  function barList(rows, fmt) { // single series, one hue: horizontal bars with the value written at the end
    const max = Math.max(1, ...rows.map((r) => r.v));
    return `<ul class="hbars">${rows.map((r) => `<li title="${esc(r.label)}: ${fmt(r.v)}"><span class="hbars__l">${esc(r.label)}</span><span class="hbars__t"><i style="width:${Math.max(2, (r.v / max) * 100)}%"></i></span><span class="hbars__v">${fmt(r.v)}</span></li>`).join('')}</ul>`;
  }

  function overviewHtml() {
    const rs = S.jobs.filter((j) => live(j) && inRange(j));
    const booked = sum(rs, (j) => j.total), collected = sum(rs.filter((j) => j.paid), (j) => j.total);
    const outstanding = sum(S.jobs.filter((j) => ['ready', 'delivered'].includes(j.status) && !j.paid), (j) => j.total);
    const newLeads = S.leads.filter((l) => l.status === 'new').length;
    const attention = [];
    S.jobs.filter((j) => j.status === 'ready' && !j.paid).forEach((j) => attention.push({ j, t: HW.t('a_att_ready_unpaid') }));
    S.jobs.filter((j) => j.status === 'delivered' && !j.paid).forEach((j) => attention.push({ j, t: HW.t('a_att_unpaid') }));
    S.jobs.filter((j) => j.approvals.some((a) => a.status === 'pending')).forEach((j) => attention.push({ j, t: HW.t('a_att_approval') }));
    S.jobs.filter((j) => j.status === 'in_progress' && new Date(j.etaAt) < new Date()).forEach((j) => attention.push({ j, t: HW.t('a_att_late') }));
    /* last 14 days */
    const days = Array.from({ length: 14 }, (_, i) => { const d = startOfDay(new Date(Date.now() - (13 - i) * 86400000)); return { d, n: S.jobs.filter((j) => live(j) && dayKey(j.createdAt) === dayKey(d)).length }; });
    const dmax = Math.max(1, ...days.map((x) => x.n));
    /* top services + payment split */
    const counts = {}; rs.forEach((j) => j.items.forEach((i) => { counts[pname(i)] = (counts[pname(i)] || 0) + i.qty; }));
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([label, v]) => ({ label, v }));
    const pays = PAY.map((m) => ({ label: payName(m), v: sum(rs.filter((j) => j.payment === m), (j) => j.total) })).filter((x) => x.v > 0).sort((a, b) => b.v - a.v);
    const today = S.jobs.filter((j) => live(j) && dayKey(j.startFrom) === dayKey(new Date()) && HW.ACTIVE.includes(j.status)).sort((a, b) => new Date(a.startFrom) - new Date(b.startFrom));
    return `
      <div class="chips range">${[['today', 'a_r_today'], ['7', 'a_r_7'], ['30', 'a_r_30'], ['all', 'a_r_all']].map(([k, l]) => `<button class="chip ${S.range === k ? 'active' : ''}" data-range="${k}">${HW.t(l)}</button>`).join('')}</div>
      <div class="kpis">
        ${tile(rs.length, HW.t('a_orders'))}${tile(HW.money(booked), HW.t('a_booked'))}${tile(HW.money(collected), HW.t('a_collected'), 'ok')}
        ${tile(HW.money(outstanding), HW.t('a_outstanding'), outstanding ? 'warn' : '')}${tile(newLeads, HW.t('stat_leads'), newLeads ? 'warn' : '')}
      </div>
      <div class="grid2">
        <section class="panel"><h3>${HW.t('a_attention')}</h3>
          ${attention.length ? `<ul class="att">${attention.map((a) => `<li data-open="${a.j.id}"><b dir="ltr">${a.j.id}</b> ${esc(a.j.customer.name)} · ${carTxt(a.j.car)}<span class="muted">${a.t}</span></li>`).join('')}</ul>` : `<p class="muted">${HW.t('a_all_good')}</p>`}
          ${newLeads ? `<button class="linklike" data-tab="leads">${newLeads} ${HW.t('stat_leads')} ›</button>` : ''}
        </section>
        <section class="panel"><h3>${HW.t('a_today')}</h3>
          ${today.length ? `<ul class="att">${today.map((j) => `<li data-open="${j.id}"><b>${HW.fmtTime(j.startFrom)}</b> ${carTxt(j.car)} · ${esc(j.customer.name)}${stChip(j.status)}</li>`).join('')}</ul>` : `<p class="muted">${HW.t('a_none_today')}</p>`}
        </section>
      </div>
      <section class="panel"><h3>${HW.t('a_per_day')}</h3>
        <div class="vbars" dir="ltr" role="img" aria-label="${HW.t('a_per_day')}">${days.map((x) => `<div class="vbars__c" title="${HW.fmtDay(x.d)}: ${x.n}"><span class="vbars__n">${x.n || ''}</span><i style="height:${x.n ? Math.max(4, (x.n / dmax) * 100) : 2}%"></i><small>${x.d.getDate()}</small></div>`).join('')}</div>
      </section>
      <div class="grid2">
        <section class="panel"><h3>${HW.t('a_top')}</h3>${top.length ? barList(top, (v) => v) : `<p class="muted">${HW.t('a_no_data')}</p>`}</section>
        <section class="panel"><h3>${HW.t('a_by_pay')}</h3>${pays.length ? barList(pays, (v) => HW.money(v)) : `<p class="muted">${HW.t('a_no_data')}</p>`}</section>
      </div>`;
  }

  /* ---------- orders ---------- */
  function filtered() {
    const q = S.q.trim().toLowerCase();
    return S.jobs.filter((j) => {
      if (S.fStatus && j.status !== S.fStatus) return false;
      if (S.fPaid === 'paid' && !j.paid) return false;
      if (S.fPaid === 'unpaid' && j.paid) return false;
      if (S.from && dayKey(j.createdAt) < S.from) return false;
      if (S.to && dayKey(j.createdAt) > S.to) return false;
      if (!q) return true;
      return `${j.id} ${j.customer.name} ${j.customer.phone} ${HW.carName(j.car, 'en')} ${HW.carName(j.car, 'ar')} ${j.items.map(pname).join(' ')}`.toLowerCase().includes(q);
    }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }
  function ordersHtml() {
    const list = filtered();
    return `
      <div class="toolbar">
        <input type="search" id="fQ" placeholder="${HW.t('a_search_orders')}" value="${esc(S.q)}">
        <select id="fStatus"><option value="">${HW.t('a_all_status')}</option>${ALL_STATUS.map((s) => `<option value="${s}" ${S.fStatus === s ? 'selected' : ''}>${HW.t('st_' + s)}</option>`).join('')}</select>
        <select id="fPaid"><option value="">${HW.t('a_all_pay')}</option><option value="paid" ${S.fPaid === 'paid' ? 'selected' : ''}>${HW.t('a_paid')}</option><option value="unpaid" ${S.fPaid === 'unpaid' ? 'selected' : ''}>${HW.t('a_unpaid')}</option></select>
        <label class="dt">${HW.t('a_from')}<input type="date" id="fFrom" value="${S.from}"></label><label class="dt">${HW.t('a_to')}<input type="date" id="fTo" value="${S.to}"></label>
        <button class="btn btn--ghost" data-act="csv-orders">${HW.t('export')} CSV</button>
      </div>
      <p class="muted small">${list.length} ${HW.t('a_orders')} · ${HW.money(sum(list.filter(live), (j) => j.total))}</p>
      <div class="tablewrap tablewrap--tall"><table class="otable"><thead><tr><th>${HW.t('a_order')}</th><th>${HW.t('a_created')}</th><th>${HW.t('customer')}</th><th>${HW.t('your_car')}</th><th>${HW.t('service')}</th><th>${HW.t('appointment')}</th><th>${HW.t('status')}</th><th>${HW.t('payment')}</th><th>${HW.t('total')}</th></tr></thead><tbody>
        ${list.map((j) => `<tr data-open="${j.id}" tabindex="0"><td dir="ltr"><b>${j.id}</b></td><td>${HW.fmtDay(j.createdAt)}</td><td>${esc(j.customer.name)}<br><small class="muted" dir="ltr">+${j.customer.phone}</small></td><td>${carTxt(j.car)}</td><td class="otable__svc">${esc(j.items.map(pname).join(' · '))}</td><td>${when(j.startFrom)}</td><td>${stChip(j.status)}</td><td>${payName(j.payment)}<br><span class="pill ${j.paid ? 'pill--ok' : 'pill--warn'}">${HW.t(j.paid ? 'a_paid' : 'a_unpaid')}</span></td><td class="num">${HW.money(j.total)}</td></tr>`).join('') || `<tr><td colspan="9" class="muted center">${HW.t('a_no_data')}</td></tr>`}
      </tbody></table></div>`;
  }

  /* ---------- order drawer ---------- */
  function drawerHtml(j) {
    const pr = HW.jobProgress(j);
    return `<div class="drawer-back" data-close></div>
    <aside class="drawer" role="dialog" aria-label="${j.id}">
      <header><div><small class="muted" dir="ltr">${j.id}</small><h3>${carTxt(j.car)}</h3></div><div class="btn-row">${stChip(j.status)}<button class="modal__x static" data-close aria-label="${HW.t('close')}">×</button></div></header>
      <div class="drawer__body" data-job="${j.id}">
        <section><h4>${HW.t('customer')}</h4>
          <p><b>${esc(j.customer.name)}</b> · <a dir="ltr" href="tel:+${j.customer.phone}">+${j.customer.phone}</a></p>
          <div class="btn-row"><a class="btn btn--ghost" target="_blank" rel="noopener" href="https://wa.me/${j.customer.phone}">WhatsApp</a><a class="btn btn--ghost" href="tel:+${j.customer.phone}">${HW.t('call_us')}</a><button class="btn btn--ghost" data-act="cust" data-phone="${j.customer.phone}">${HW.t('a_customer_page')}</button></div>
          ${j.notes ? `<p class="muted"><b>${HW.t('f_notes')}:</b> ${esc(j.notes)}</p>` : ''}</section>
        <section><h4>${HW.t('service')}</h4>
          <ul class="qlist">${j.items.map((i) => `<li><span>${esc(pname(i))}${i.qty > 1 ? ' × ' + i.qty : ''}</span><span>${HW.money(i.price)}</span></li>`).join('')}</ul>
          ${j.approvals.map((a) => `<p class="small muted">${esc(a.title)} · ${HW.money(a.price)} · <b>${HW.t(a.status === 'pending' ? 'awaiting' : a.status)}</b></p>`).join('')}
          <div class="grand sum"><span>${HW.t('total')}</span><span>${HW.money(j.total)}</span></div></section>
        <section><h4>${HW.t('appointment')}</h4>
          <dl class="facts"><div><dt>${HW.t('appointment')}</dt><dd>${when(j.startFrom)}</dd></div><div><dt>${HW.t('ready_by')}</dt><dd>${pr.eta ? when(pr.eta) : '–'}</dd></div><div><dt>${HW.t('bay')}</dt><dd>${j.bay || '–'}</dd></div><div><dt>${HW.t('progress')}</dt><dd>${pr.pct}%</dd></div></dl>
          <div class="sgroup"><select id="dStatus">${ALL_STATUS.map((s) => `<option value="${s}" ${j.status === s ? 'selected' : ''}>${HW.t('st_' + s)}</option>`).join('')}</select><button class="btn btn--gold" data-act="set-status">${HW.t('a_apply')}</button></div></section>
        <section><h4>${HW.t('payment')}</h4>
          <div class="sgroup"><select id="dPay">${PAY.map((m) => `<option value="${m}" ${j.payment === m ? 'selected' : ''}>${payName(m)}</option>`).join('')}</select>
            <button class="btn ${j.paid ? 'btn--ghost' : 'btn--gold'}" data-act="toggle-paid">${HW.t(j.paid ? 'a_mark_unpaid' : 'a_mark_paid')}</button>
            <span class="pill ${j.paid ? 'pill--ok' : 'pill--warn'}">${HW.t(j.paid ? 'a_paid' : 'a_unpaid')}${j.paidAt ? ' · ' + HW.fmtDay(j.paidAt) : ''}</span></div>
          ${['deema', 'taly'].includes(j.payment) && !j.paid ? `<a class="linklike" target="_blank" rel="noopener" href="https://wa.me/${j.customer.phone}?text=${encodeURIComponent((j.lang === 'en' ? 'Your payment link for order ' : 'رابط الدفع لطلبك ') + j.id + ': ')}">${HW.t('a_send_link')}</a>` : ''}</section>
        <section><h4>${HW.t('a_internal')}</h4><textarea id="dNote" rows="3" placeholder="${HW.t('a_internal_ph')}">${esc(j.internalNote || '')}</textarea><button class="btn btn--ghost" data-act="save-note">${HW.t('save')}</button></section>
        <section><h4>${HW.t('updates')}</h4><ul class="feed feed--sm">${[...j.updates].reverse().map((u) => `<li><time>${HW.fmtWhen(u.at)}</time><div>${u.kind === 'status' ? `${HW.t('feed_status')}: <b>${HW.t('st_' + u.status)}</b>` : esc(u.text || HW.t('feed_eta'))}</div></li>`).join('')}</ul></section>
        <div class="btn-row"><button class="btn btn--ghost" data-act="print">${HW.t('a_print')}</button><a class="btn btn--ghost" target="_blank" href="job.html?id=${j.id}">${HW.t('customer_view')}</a><a class="btn btn--ghost" href="staff.html">${HW.t('a_staff_board')}</a>${j.status !== 'cancelled' && j.status !== 'delivered' ? `<button class="btn btn--ghost danger" data-act="cancel-order">${HW.t('cancel_booking')}</button>` : ''}</div>
      </div>
    </aside>`;
  }

  function printSheet(j) {
    const el = HW.$('#printSheet'); const pr = HW.jobProgress(j);
    el.innerHTML = `<h1>HeroWorks</h1><p>${HW.CONTACT.phone}</p><hr><h2>${HW.t('a_order')} ${j.id}</h2>
      <p><b>${HW.t('customer')}:</b> ${esc(j.customer.name)} (+${j.customer.phone})</p><p><b>${HW.t('your_car')}:</b> ${carTxt(j.car)}</p>
      <p><b>${HW.t('appointment')}:</b> ${when(j.startFrom)} · <b>${HW.t('ready_by')}:</b> ${pr.eta ? when(pr.eta) : '–'}</p>
      <table>${j.items.map((i) => `<tr><td>${esc(pname(i))}${i.qty > 1 ? ' × ' + i.qty : ''}</td><td style="text-align:end">${HW.money(i.price)}</td></tr>`).join('')}<tr><th>${HW.t('total')}</th><th style="text-align:end">${HW.money(j.total)}</th></tr></table>
      <p><b>${HW.t('payment')}:</b> ${payName(j.payment)} – ${HW.t(j.paid ? 'a_paid' : 'a_unpaid')}</p>${j.notes ? `<p><b>${HW.t('f_notes')}:</b> ${esc(j.notes)}</p>` : ''}${j.internalNote ? `<p><b>${HW.t('a_internal')}:</b> ${esc(j.internalNote)}</p>` : ''}`;
    document.body.classList.add('printing'); window.print(); setTimeout(() => document.body.classList.remove('printing'), 500);
  }

  /* ---------- schedule ---------- */
  function scheduleHtml() {
    const days = Array.from({ length: 14 }, (_, i) => startOfDay(new Date(Date.now() + i * 86400000)));
    return `<div class="sched">${days.map((d) => {
      const closed = HW.sched.isClosedDay(d), list = S.jobs.filter((j) => live(j) && dayKey(j.startFrom) === dayKey(d) && j.status !== 'delivered').sort((a, b) => new Date(a.startFrom) - new Date(b.startFrom));
      return `<section class="panel sched__day ${closed ? 'is-closed' : ''}"><h4>${HW.fmtDay(d)} ${closed ? `<span class="pill pill--warn">${HW.t('a_closed')}</span>` : `<span class="count">${list.length}</span>`}</h4>
        ${list.map((j) => `<div class="sched__row" data-open="${j.id}"><b>${HW.fmtTime(j.startFrom)}</b><span>${carTxt(j.car)}<small class="muted"> · ${esc(j.customer.name)} · ${esc(j.items.map(pname).join(' · '))}</small></span>${stChip(j.status)}</div>`).join('') || (closed ? '' : `<p class="muted small">${HW.t('a_free_day')}</p>`)}</section>`;
    }).join('')}</div>`;
  }

  /* ---------- customers ---------- */
  function customers() {
    const m = new Map();
    const get = (phone, name) => { if (!m.has(phone)) m.set(phone, { phone, name, jobs: [], cars: new Map(), registered: false }); return m.get(phone); };
    S.users.forEach((u) => { const c = get(u.phone, u.name); c.registered = true; c.name = u.name; (u.cars || []).forEach((x) => c.cars.set(x.id, x)); });
    [...S.jobs].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)).forEach((j) => { const c = get(j.customer.phone, j.customer.name); c.name = j.customer.name; c.jobs.push(j); c.cars.set(j.car.id, j.car); });
    return [...m.values()].map((c) => ({ ...c, spent: sum(c.jobs.filter(live), (j) => j.total), last: c.jobs.length ? c.jobs[c.jobs.length - 1].createdAt : null })).sort((a, b) => b.spent - a.spent);
  }
  function customersHtml() {
    const q = S.q.trim().toLowerCase();
    const list = customers().filter((c) => !q || `${c.name} ${c.phone}`.toLowerCase().includes(q));
    return `<div class="toolbar"><input type="search" id="fQ" placeholder="${HW.t('a_search_cust')}" value="${esc(S.q)}"><button class="btn btn--ghost" data-act="csv-cust">${HW.t('export')} CSV</button></div>
      <p class="muted small">${list.length} ${HW.t('a_customers')}</p>
      <div class="tablewrap tablewrap--tall"><table class="otable"><thead><tr><th>${HW.t('f_name')}</th><th>${HW.t('f_phone')}</th><th>${HW.t('a_orders')}</th><th>${HW.t('a_spent')}</th><th>${HW.t('a_last')}</th><th>${HW.t('my_cars')}</th></tr></thead><tbody>
      ${list.map((c) => `<tr data-cust="${c.phone}" tabindex="0"><td><b>${esc(c.name)}</b>${c.registered ? ` <span class="tag">${HW.t('a_account')}</span>` : ''}</td><td dir="ltr">+${c.phone}</td><td class="num">${c.jobs.length}</td><td class="num">${HW.money(c.spent)}</td><td>${c.last ? HW.fmtDay(c.last) : '–'}</td><td>${[...c.cars.values()].map((x) => esc(HW.carName(x, HW.lang))).join('، ')}</td></tr>
        ${S.cust === c.phone ? `<tr class="subrow"><td colspan="6"><div class="btn-row"><a class="btn btn--ghost" target="_blank" rel="noopener" href="https://wa.me/${c.phone}">WhatsApp</a><a class="btn btn--ghost" href="tel:+${c.phone}">${HW.t('call_us')}</a></div>${c.jobs.length ? `<ul class="att">${[...c.jobs].reverse().map((j) => `<li data-open="${j.id}"><b dir="ltr">${j.id}</b> ${HW.fmtDay(j.createdAt)} · ${carTxt(j.car)} · ${esc(j.items.map(pname).join(' · '))}${stChip(j.status)}<span class="num">${HW.money(j.total)}</span></li>`).join('')}</ul>` : `<p class="muted">${HW.t('a_no_orders')}</p>`}</td></tr>` : ''}`).join('')}
      </tbody></table></div>`;
  }

  /* ---------- requests (assistant leads) ---------- */
  function leadsHtml() {
    if (!S.leads.length) return `<p class="muted">${HW.t('no_leads')}</p>`;
    return `<div class="leads">${S.leads.map((l) => `<article class="panel lead ${l.status === 'new' ? 'new' : ''}" data-lead="${l.id}">
      <header><b dir="ltr">${l.id}</b><time class="muted">${HW.fmtWhen(l.createdAt)}</time>${l.status === 'new' ? `<span class="pill pill--warn">${HW.t('new')}</span>` : ''}</header>
      <p><b>${esc(l.name)}</b> · <a dir="ltr" href="tel:+${l.phone}">+${l.phone}</a></p><p>${esc(l.carText || '–')}${l.car ? ` <span class="tag">${l.car.cls}</span>` : ''}</p>
      <p class="muted">${(l.services || []).map(esc).join(' · ') || '–'}</p><p>${HW.t('when')}: <b>${esc(l.when || '–')}</b></p>${l.notes ? `<p class="muted">${esc(l.notes)}</p>` : ''}
      <div class="btn-row"><a class="btn btn--gold" target="_blank" rel="noopener" href="https://wa.me/${l.phone}?text=${encodeURIComponent(l.lang === 'en' ? `Hello ${l.name}, this is HeroWorks about your request.` : `مرحباً ${l.name}، معك هيرو ووركس بخصوص طلبك.`)}">WhatsApp</a><a class="btn btn--ghost" href="tel:+${l.phone}">${HW.t('call_us')}</a>
        <button class="btn btn--ghost" data-act="lead-done">${l.status === 'new' ? HW.t('mark_done') : HW.t('reopen')}</button></div></article>`).join('')}</div>`;
  }

  /* ---------- services & prices ---------- */
  function servicesHtml() {
    const ov = HW.getCatalogOv(), q = S.svcQ.trim().toLowerCase();
    const list = HW.ALL_PRODUCTS.filter((p) => !q || `${p.name.en} ${p.name.ar}`.toLowerCase().includes(q));
    return `<div class="toolbar"><input type="search" id="fSvc" placeholder="${HW.t('a_search_svc')}" value="${esc(S.svcQ)}"><button class="btn btn--gold" data-act="svc-save">${HW.t('save')}</button><button class="btn btn--ghost" data-act="svc-reset">${HW.t('a_svc_reset')}</button></div>
      <p class="muted small">${HW.t('a_svc_p')} <a class="linklike" href="staff.html">${HW.t('tab_pricing')}</a></p>
      <div class="tablewrap tablewrap--tall"><table class="otable ptable"><thead><tr><th>${HW.t('service')}</th><th>${HW.t('a_visible')}</th><th>${HW.t('a_price_s')}</th><th>${HW.t('a_old_price')}</th><th>${HW.t('a_minutes')}</th></tr></thead><tbody>
      ${list.map((p) => { const o = ov[p.id] || {}; return `<tr data-pid="${p.id}"><td><b>${esc(HW.L(p.name))}</b><br><small class="muted">${esc(HW.L(HW.findCat(p.cat).name))}</small></td>
        <td><input type="checkbox" class="s-vis" ${o.hidden ? '' : 'checked'}></td>
        <td><input type="number" step="0.5" min="0" class="s-base" placeholder="${p._base}" value="${typeof o.base === 'number' ? o.base : ''}" dir="ltr"></td>
        <td><input type="number" step="0.5" min="0" class="s-was" placeholder="${p._was || ''}" value="${'was' in o ? (o.was || '') : ''}" dir="ltr"></td>
        <td>${p.type === 'service' ? `<input type="number" step="5" min="5" class="s-dur" placeholder="${HW.durationFor({ ...p, id: p.id + '_x' }, null)}" value="${typeof o.dur === 'number' ? o.dur : ''}" dir="ltr">` : '–'}</td></tr>`; }).join('')}
      </tbody></table></div>`;
  }
  function saveServices() {
    const ov = { ...HW.getCatalogOv() };
    HW.$$('tr[data-pid]').forEach((tr) => {
      const id = tr.dataset.pid, p = HW.findProduct(id), o = {};
      if (!tr.querySelector('.s-vis').checked) o.hidden = true;
      const b = tr.querySelector('.s-base').value, w = tr.querySelector('.s-was').value, d = tr.querySelector('.s-dur') && tr.querySelector('.s-dur').value;
      if (b !== '' && Number(b) >= 0) o.base = Number(b);
      if (w !== '' && Number(w) >= 0) o.was = Number(w);
      else if (w === '' && 'was' in (ov[id] || {}) && false) o.was = 0;
      if (d !== '' && d != null && Number(d) > 0) o.dur = Number(d);
      if (Object.keys(o).length) ov[id] = o; else delete ov[id];
      void p;
    });
    HW.saveCatalog(ov); HW.toast(HW.t('saved'));
  }

  /* ---------- settings ---------- */
  function settingsHtml() {
    const C = HW.CONFIG, W = C.workHours;
    return `
      ${S.owner && S.owner.isDefault ? `<div class="banner banner--warn"><b>${HW.t('a_default_pw')}</b> ${HW.t('a_default_pw_p')}</div>` : ''}
      <div class="grid2">
      <section class="panel"><h3>${HW.t('a_hours')}</h3>
        <div class="mults"><div class="field"><label>${HW.t('a_open')}</label><input type="number" id="sStart" min="0" max="23" value="${W.start}" dir="ltr"></div><div class="field"><label>${HW.t('a_close')}</label><input type="number" id="sEnd" min="1" max="24" value="${W.end}" dir="ltr"></div><div class="field"><label>${HW.t('friday')} ${HW.t('a_open')}</label><input type="number" id="sFri" min="0" max="23" value="${W.fridayStart}" dir="ltr"></div>
        <div class="field"><label>${HW.t('bays')}</label><input type="number" id="sBays" min="1" max="20" value="${C.bays}" dir="ltr"></div><div class="field"><label>${HW.t('a_days_ahead')}</label><input type="number" id="sDays" min="1" max="120" value="${C.bookingDays}" dir="ltr"></div></div>
        <button class="btn btn--gold" data-act="save-hours">${HW.t('save')}</button></section>
      <section class="panel"><h3>${HW.t('a_closed_days')}</h3><p class="muted small">${HW.t('a_closed_p')}</p>
        <div class="sgroup"><input type="date" id="sClosed"><button class="btn btn--ghost" data-act="add-closed">${HW.t('a_add')}</button></div>
        <div class="chips">${(C.closedDates || []).slice().sort().map((d) => `<button class="chip" data-rm-closed="${d}" dir="ltr" title="${HW.t('remove')}">${d} ×</button>`).join('') || `<span class="muted small">–</span>`}</div></section>
      <section class="panel"><h3>${HW.t('a_about_t')}</h3><p class="muted small">${HW.t('a_about_p')}</p>
        <div class="field"><label>العربية</label><textarea id="sAboutAr" rows="5" dir="rtl">${esc(C.about.ar)}</textarea></div><div class="field"><label>English</label><textarea id="sAboutEn" rows="5" dir="ltr">${esc(C.about.en)}</textarea></div>
        <button class="btn btn--gold" data-act="save-about">${HW.t('save')}</button></section>
      <section class="panel"><h3>${HW.t('cameras')}</h3><p class="muted small">${HW.t('a_cam_p')}</p>
        ${Array.from({ length: C.bays }, (_, i) => `<div class="field"><label>${HW.t('bay')} ${i + 1}</label><input class="sCam" data-bay="${i + 1}" dir="ltr" placeholder="https://…/index.m3u8" value="${esc(C.cameraStreams[i + 1] || '')}"></div>`).join('')}
        <button class="btn btn--gold" data-act="save-cams">${HW.t('save')}</button></section>
      <section class="panel"><h3>${HW.t('a_security')}</h3>
        <div class="field"><label>${HW.t('a_staff_pin')}</label><input id="sPin" dir="ltr" inputmode="numeric" value="${esc(C.staffPin)}"></div><button class="btn btn--ghost" data-act="save-pin">${HW.t('save')}</button>
        <hr class="sep"><p class="muted small">${HW.t('a_owner_login')}: <b dir="ltr">${esc(S.owner ? S.owner.user : '')}</b></p>
        <div class="field"><label>${HW.t('a_user')}</label><input id="sOwnUser" dir="ltr" autocapitalize="none" value="${esc(S.owner ? S.owner.user : '')}"></div>
        <div class="field"><label>${HW.t('a_new_pw')}</label><input id="sOwnPw" type="password" dir="ltr" autocomplete="new-password"><small class="muted">${HW.t('a_pw_hint')}</small></div>
        <button class="btn btn--gold" data-act="save-owner">${HW.t('save')}</button></section>
      <section class="panel"><h3>${HW.t('tools')}</h3>
        <div class="btn-row"><button class="btn btn--ghost" data-act="export-all">${HW.t('a_export_all')}</button></div><hr class="sep">
        <p class="muted small">${HW.t('demo_tools_p')}</p>
        <div class="btn-row"><button class="btn btn--ghost" data-act="reset-demo">${HW.t('reset_demo')}</button><button class="btn btn--ghost danger" data-act="wipe">${HW.t('wipe')}</button></div></section>
      </div>`;
  }

  /* ---------- paint + events ---------- */
  const TABS = [['overview', 'a_t_overview'], ['orders', 'a_t_orders'], ['schedule', 'a_t_schedule'], ['customers', 'a_t_customers'], ['leads', 'tab_leads'], ['services', 'a_t_services'], ['settings', 'a_t_settings']];

  function paint() {
    const root = HW.$('#adminRoot');
    if (!HW.api.ownerOk()) { gate(root); return; }
    const focusId = document.activeElement && document.activeElement.id, selStart = document.activeElement && document.activeElement.selectionStart;
    const newLeads = S.leads.filter((l) => l.status === 'new').length, unpaid = S.jobs.filter((j) => ['ready', 'delivered'].includes(j.status) && !j.paid).length;
    const j = S.open && S.jobs.find((x) => x.id === S.open);
    root.innerHTML = `
      <div class="acct-head"><div><h2>${HW.t('a_title')}</h2>${HW.CONFIG.demoMode ? '<span class="demo-pill">DEMO</span>' : ''}</div>
        <div class="btn-row"><a class="btn btn--ghost" href="staff.html">${HW.t('a_staff_board')}</a><button class="btn btn--ghost" data-act="logout">${HW.t('logout')}</button></div></div>
      ${S.owner && S.owner.isDefault && S.tab !== 'settings' ? `<div class="banner banner--warn"><b>${HW.t('a_default_pw')}</b> <button class="linklike" data-tab="settings">${HW.t('a_default_pw_p')}</button></div>` : ''}
      <div class="tabs2 tabs2--scroll">${TABS.map(([k, l]) => `<button class="${S.tab === k ? 'active' : ''}" data-tab="${k}">${HW.t(l)}${k === 'leads' && newLeads ? ` <em class="dotn">${newLeads}</em>` : ''}${k === 'orders' && unpaid ? ` <em class="dotn">${unpaid}</em>` : ''}</button>`).join('')}</div>
      ${{ overview: overviewHtml, orders: ordersHtml, schedule: scheduleHtml, customers: customersHtml, leads: leadsHtml, services: servicesHtml, settings: settingsHtml }[S.tab]()}
      ${j ? drawerHtml(j) : ''}`;
    HW.applyI18n();
    if (focusId) { const el = document.getElementById(focusId); if (el) { el.focus(); try { el.setSelectionRange(selStart, selStart); } catch { /* not a text field */ } } }
  }

  async function act(fn, ok) { try { await fn(); await load(); paint(); if (ok) HW.toast(HW.t(ok)); } catch (ex) { err(ex); } }
  const sel = (id) => HW.$(id);

  async function onClick(e) {
    const t = e.target;
    const tab = t.closest('[data-tab]'); if (tab) { S.tab = tab.dataset.tab; S.open = null; paint(); window.scrollTo(0, 0); return; }
    const rg = t.closest('[data-range]'); if (rg) { S.range = rg.dataset.range; paint(); return; }
    if (t.closest('[data-close]')) { S.open = null; paint(); return; }
    const cu = t.closest('[data-cust]'); if (cu && !t.closest('a')) { S.cust = S.cust === cu.dataset.cust ? null : cu.dataset.cust; paint(); return; }
    const op = t.closest('[data-open]'); if (op && !t.closest('a,button')) { S.open = op.dataset.open; paint(); return; }
    const rc = t.closest('[data-rm-closed]'); if (rc) { HW.saveSettings({ closedDates: HW.CONFIG.closedDates.filter((d) => d !== rc.dataset.rmClosed) }); paint(); return; }
    const a = t.closest('[data-act]'); if (!a) return;
    const kind = a.dataset.act, id = S.open;
    switch (kind) {
      case 'logout': await HW.api.ownerLogout(); paint(); break;
      case 'csv-orders': csv('heroworks-orders.csv', JOB_HEAD, filtered().map(jobRow)); break;
      case 'csv-cust': csv('heroworks-customers.csv', ['Name', 'Phone', 'Orders', 'Spent KD', 'Last order', 'Registered', 'Cars'], customers().map((c) => [c.name, '+' + c.phone, c.jobs.length, c.spent.toFixed(3), c.last ? new Date(c.last).toLocaleDateString('en-GB') : '', c.registered ? 'yes' : 'no', [...c.cars.values()].map((x) => HW.carName(x, 'en')).join(' | ')])); break;
      case 'cust': S.tab = 'customers'; S.cust = a.dataset.phone; S.open = null; paint(); break;
      case 'set-status': await act(() => HW.api.setStatus(id, sel('#dStatus').value)); break;
      case 'toggle-paid': { const j = S.jobs.find((x) => x.id === id); await act(() => HW.api.setPaid(id, !j.paid, sel('#dPay').value), 'saved'); break; }
      case 'save-note': await act(() => HW.api.setInternalNote(id, sel('#dNote').value), 'saved'); break;
      case 'print': printSheet(S.jobs.find((x) => x.id === id)); break;
      case 'cancel-order': if (confirm(HW.t('cancel_confirm'))) await act(() => HW.api.cancelJob(id)); break;
      case 'lead-done': { const l = S.leads.find((x) => x.id === a.closest('[data-lead]').dataset.lead); await act(() => HW.api.setLeadStatus(l.id, l.status === 'new' ? 'done' : 'new')); break; }
      case 'svc-save': saveServices(); paint(); break;
      case 'svc-reset': if (confirm(HW.t('a_svc_reset_confirm'))) { HW.saveCatalog({}); paint(); } break;
      case 'save-hours': {
        const n = (i) => Number(sel(i).value);
        if (n('#sEnd') <= n('#sStart') || n('#sBays') < 1) { HW.toast(HW.t('err_bad_details')); break; }
        HW.saveSettings({ workHours: { start: n('#sStart'), end: n('#sEnd'), fridayStart: n('#sFri') }, bays: n('#sBays'), bookingDays: n('#sDays') }); HW.toast(HW.t('saved')); paint(); break;
      }
      case 'add-closed': { const v = sel('#sClosed').value; if (v && !HW.CONFIG.closedDates.includes(v)) HW.saveSettings({ closedDates: [...HW.CONFIG.closedDates, v] }); paint(); break; }
      case 'save-about': HW.saveSettings({ about: { ar: sel('#sAboutAr').value, en: sel('#sAboutEn').value } }); HW.toast(HW.t('saved')); break;
      case 'save-cams': { const cams = {}; HW.$$('.sCam').forEach((i) => { cams[i.dataset.bay] = i.value.trim(); }); HW.saveSettings({ cameraStreams: cams }); HW.toast(HW.t('saved')); break; }
      case 'save-pin': { const v = sel('#sPin').value.trim(); if (v.length < 4) { HW.toast(HW.t('err_bad_details')); break; } HW.saveSettings({ staffPin: v }); HW.toast(HW.t('saved')); break; }
      case 'save-owner': try { S.owner = await HW.api.changeOwner({ user: sel('#sOwnUser').value, password: sel('#sOwnPw').value }); HW.toast(HW.t('saved')); paint(); } catch (ex) { err(ex); } break;
      case 'export-all': { const b = new Blob([JSON.stringify({ jobs: S.jobs, leads: S.leads, customers: S.users, exportedAt: new Date().toISOString() }, null, 2)], { type: 'application/json' }); const l = document.createElement('a'); l.href = URL.createObjectURL(b); l.download = 'heroworks-export.json'; l.click(); break; }
      case 'reset-demo': if (confirm(HW.t('reset_confirm'))) { S.quiet = true; await act(() => HW.api.resetDemo(), 'saved'); setTimeout(() => { S.quiet = false; }, 1500); }; break;
      case 'wipe': if (confirm(HW.t('wipe_confirm'))) { S.quiet = true; await act(() => HW.api.wipeAll(), 'saved'); setTimeout(() => { S.quiet = false; }, 1500); }; break;
      default: break;
    }
  }

  function beep() { try { const c = new (window.AudioContext || window.webkitAudioContext)(), o = c.createOscillator(), g = c.createGain(); o.connect(g); g.connect(c.destination); o.frequency.value = 880; g.gain.value = 0.06; o.start(); o.stop(c.currentTime + 0.18); } catch { /* sound is optional */ } }

  HW.boot(() => {
    const root = HW.$('#adminRoot');
    root.onclick = onClick;
    root.oninput = (e) => {
      const id = e.target.id;
      if (id === 'fQ') { S.q = e.target.value; paint(); } else if (id === 'fSvc') { S.svcQ = e.target.value; paint(); }
    };
    root.onchange = (e) => {
      const id = e.target.id;
      if (id === 'fStatus') S.fStatus = e.target.value; else if (id === 'fPaid') S.fPaid = e.target.value; else if (id === 'fFrom') S.from = e.target.value; else if (id === 'fTo') S.to = e.target.value; else return;
      paint();
    };
    root.onkeydown = (e) => { if (e.key === 'Enter') { const r = e.target.closest('tr[data-open],tr[data-cust]'); if (r) r.click(); } if (e.key === 'Escape' && S.open) { S.open = null; paint(); } };
    (HW.api.ownerOk() ? load() : Promise.resolve()).then(() => { S.seen = new Set(S.jobs.map((j) => j.id)); paint(); });
  });

  HW.api.onChange(() => {
    if (!HW.api.ownerOk()) return;
    const ae = document.activeElement;
    load().then(() => {
      const fresh = S.seen ? S.jobs.filter((j) => !S.seen.has(j.id) && Date.now() - new Date(j.createdAt) < 600000) : [];
      S.seen = new Set(S.jobs.map((j) => j.id));
      if (fresh.length && !S.quiet) { HW.toast(HW.t('a_new_order')); beep(); document.title = '● ' + document.title.replace(/^● /, ''); }
      if (ae && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName) && ae.id !== 'fQ' && ae.id !== 'fSvc') return; // do not disturb typing
      paint();
    });
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) document.title = document.title.replace(/^● /, ''); });
  setInterval(() => { const ae = document.activeElement; if (!document.hidden && HW.api.ownerOk() && !(ae && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName)) && !S.open) paint(); }, 60000);
})();
