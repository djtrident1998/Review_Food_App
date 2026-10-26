import React from 'react';
import { createRoot } from 'react-dom/client';
import htm from 'htm';
import './styles.css';
import { RESTAURANTS as R, DISH_PRICE, HUE, SIGNATURE, WORDS, SUBS, PRICE_NOTE, VISITS, restById } from '../lib/catalog.js';
import { remote, local, adminToken, LS, ApiError } from './backend.js';

const html = htm.bind(React.createElement);
const GOOD = {bg:'var(--tone-good)', fg:'var(--tone-good-fg)'}, MID = {bg:'var(--tone-mid)', fg:'var(--tone-mid-fg)'}, LOW = {bg:'var(--tone-low)', fg:'var(--tone-low-fg)'};
const cuisineOpts = ['All'].concat([...new Set(R.flatMap(r => r.cuisines))].sort());
const POLL_MS = 20000;

function rel(ts){ const s=(Date.now()-ts)/1000; if(s<45) return 'just now'; const m=s/60; if(m<60) return Math.round(m)+' min ago'; const h=m/60; if(h<24) return Math.round(h)+' hr ago'; const d=h/24; if(d<2) return 'yesterday'; if(d<7) return Math.round(d)+' days ago'; if(d<30){const w=Math.round(d/7);return w+' week'+(w>1?'s':'')+' ago';} if(d<365){const mo=Math.max(1,Math.round(d/30));return mo+' month'+(mo>1?'s':'')+' ago';} const y=Math.round(d/365); return y+' year'+(y>1?'s':'')+' ago'; }
function full(ts){ return new Date(ts).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'}); }
function hm(x){ x = x % 24; return String(Math.floor(x)).padStart(2,'0') + ':' + (x % 1 ? '30' : '00'); }
function openInfo(h){ const n=new Date(); let t=n.getHours()+n.getMinutes()/60; const o=h[0], c=h[1]; if (c>24 && t+24<c) t+=24; const open=t>=o&&t<c; return {open, label: open ? 'Open · till '+hm(c) : 'Closed · opens '+hm(o), hours: hm(o)+' – '+hm(c)}; }
function initials(n){ return String(n||'').trim().split(/\s+/).slice(0,2).map(p=>p[0]||'').join('').toUpperCase() || '?'; }
const tone = (avg, n) => !n ? {bg:'var(--color-neutral-200)', fg:'var(--color-text)'} : avg >= 4 ? GOOD : avg >= 3 ? MID : LOW;
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g,'-');

function resizeImage(file, max, q){
  return new Promise((res, rej) => { const rd = new FileReader(); rd.onerror = rej;
    rd.onload = () => { const img = new Image(); img.onerror = rej; img.onload = () => { const k = Math.min(1, max / Math.max(img.width, img.height)); const c = document.createElement('canvas'); c.width = Math.round(img.width*k); c.height = Math.round(img.height*k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); res(c.toDataURL('image/jpeg', q)); }; img.src = rd.result; };
    rd.readAsDataURL(file); });
}

/* ── Icons (Lucide) ── */
const Star = ({size=12, fill='currentColor', sw=2, style}) => html`<svg width=${size} height=${size} viewBox="0 0 24 24" fill=${fill} stroke="currentColor" strokeWidth=${sw} strokeLinejoin="miter" aria-hidden="true" style=${style}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`;
const Bookmark = ({size=20, on}) => html`<svg width=${size} height=${size} viewBox="0 0 24 24" fill=${on ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"></path></svg>`;

/* A coloured plate standing in for a food photo. */
function Plate({hue, word, kind, label}){
  const bg = `radial-gradient(120% 90% at 85% 10%, oklch(0.80 0.13 ${hue+20}) 0%, transparent 60%), linear-gradient(140deg, oklch(0.62 0.15 ${hue}) 0%, oklch(0.42 0.12 ${hue-25}) 100%)`;
  return html`<div className=${'photo' + (kind ? ' ' + kind : '')} style=${kind === 'round' ? {borderRadius:'50%'} : null}>
    <div className="plate" style=${{background:bg}} role="img" aria-label=${label || word}><span className="plate-word" aria-hidden="true">${word}</span></div>
  </div>`;
}

class App extends React.Component {
  state = { view:'explore', prevView:'explore', restId:null, search:'', cuisine:'All', minRating:0, price:0, vegOnly:false, sort:'top', reviewSort:'newest',
    form:null, toast:null, confirmDel:null, flash:null,
    status:'loading', loadError:null, reviews:[], admin:false, saved: (LS.get('plateindex.saved') || []).filter(restById), myName: LS.get('plateindex.name') || '' };
  backend = remote;
  starRef = React.createRef();
  reviewsRef = React.createRef();

  componentDidMount(){
    adminToken();
    this._key = e => { if (e.key === 'Escape') { if (this.state.confirmDel) this.setState({confirmDel:null}); else if (this.state.form) this.setState({form:null}); } };
    window.addEventListener('keydown', this._key);
    this._hash = () => { const h = location.hash.slice(1); if (restById(h)) this.openRest(h, true); };
    window.addEventListener('hashchange', this._hash); this._hash();
    this._vis = () => { if (document.visibilityState === 'visible') this.refresh(); };
    document.addEventListener('visibilitychange', this._vis);
    this._poll = setInterval(() => { if (document.visibilityState === 'visible') this.refresh(); }, POLL_MS);
    this.refresh();
  }
  componentWillUnmount(){ window.removeEventListener('keydown', this._key); window.removeEventListener('hashchange', this._hash); document.removeEventListener('visibilitychange', this._vis); clearInterval(this._poll); clearTimeout(this._t); }
  componentDidUpdate(_, prev){
    if (!prev.form && this.state.form) requestAnimationFrame(() => { const b = this.starRef.current && this.starRef.current.querySelector('[tabindex="0"]'); b && b.focus(); });
  }

  /* Reload every review. Switches to browser-only mode when the deployment has no storage connected. */
  async refresh(){
    try {
      const data = await this.backend.load();
      this.setState({reviews: data.reviews, admin: !!data.admin, status: this.backend.kind, loadError: null});
    } catch (e) {
      if (e instanceof ApiError && e.status === 503 && this.backend === remote) { this.backend = local; return this.refresh(); }
      this.setState(s => ({status: s.status === 'loading' ? 'error' : s.status, loadError: e.message}));
    }
  }

  toast(msg){ clearTimeout(this._t); this.setState({toast:msg}); this._t = setTimeout(() => this.setState({toast:null}), 3200); }
  go(view, extra){ this.setState(s => Object.assign({view, prevView: s.view === 'detail' ? s.prevView : s.view}, extra || {})); window.scrollTo(0,0); if (view !== 'detail' && location.hash) { try { history.replaceState(null, '', location.pathname + location.search); } catch(e) {} } }
  openRest(id, fromHash){ this.go('detail', {restId:id, reviewSort:'newest'}); if (!fromHash) { try { history.replaceState(null, '', '#' + id); } catch(e) {} } }
  toggleSave(id){
    const has = this.state.saved.includes(id);
    const saved = has ? this.state.saved.filter(x => x !== id) : [id].concat(this.state.saved);
    this.setState({saved}); LS.set('plateindex.saved', saved);
    this.toast(has ? 'Removed from Saved' : 'Saved to your shortlist');
  }

  patchForm(p){ this.setState(s => ({form: Object.assign({}, s.form, p)})); }
  openForm(restId, review){
    if (this.state.status === 'loading' || this.state.status === 'error') { this.toast('Reviews haven’t loaded yet. Try again in a moment.'); return; }
    const f = review
      ? {editId:review.id, restId, rating:review.rating, hover:0, name:review.authorName, title:review.title||'', text:review.text, visitType:review.visitType, dishes:(review.dishes||[]).slice(), sub:Object.assign({food:0,service:0,ambience:0,value:0}, review.subRatings||{}), photos:(review.photos||[]).slice(), saving:false, tried:false, blurText:false, blurName:false}
      : {editId:null, restId, rating:0, hover:0, name:this.state.myName||'', title:'', text:'', visitType:'Dine-in', dishes:[], sub:{food:0,service:0,ambience:0,value:0}, photos:[], saving:false, tried:false, blurText:false, blurName:false};
    this.setState({form:f});
  }
  addPhotos(e){
    const files = Array.from(e.target.files || []); e.target.value = '';
    const room = 3 - this.state.form.photos.length; if (room <= 0) return;
    if (files.length > room) this.toast('Only 3 photos per review. Extra files were skipped.');
    files.filter(f => /^image\//.test(f.type)).slice(0, room).forEach(file => {
      resizeImage(file, 640, 0.7).then(url => this.setState(s => s.form && s.form.photos.length < 3 ? {form: Object.assign({}, s.form, {photos: s.form.photos.concat(url)})} : null))
        .catch(() => this.toast('That photo couldn’t be read. Try a JPEG or PNG.'));
    });
  }
  canSubmit(f){ const n = f.text.trim().length; return !!(f.rating && n >= 10 && n <= 1000 && f.name.trim()); }
  async submit(e){
    e && e.preventDefault();
    const f = this.state.form; if (!f || f.saving) return;
    if (!this.canSubmit(f)) { this.patchForm({tried:true}); return; }
    this.patchForm({saving:true});
    const anySub = SUBS.some(([k]) => f.sub[k]);
    const input = {restaurantId:f.restId, authorName:f.name.trim(), rating:f.rating, title:f.title.trim(), text:f.text.trim(), visitType:f.visitType, dishes:f.dishes, subRatings: anySub ? f.sub : null, photos:f.photos};
    let id;
    try { id = (f.editId ? await this.backend.edit(f.editId, input) : await this.backend.create(input)).id; }
    catch (err) { this.patchForm({saving:false}); this.toast(err.message); return; }
    LS.set('plateindex.name', input.authorName);
    await this.refresh();
    this.setState(s => ({form:null, flash:id, myName: input.authorName, reviewSort: f.editId ? s.reviewSort : 'newest'}));
    this.toast(f.editId ? 'Review updated' : this.state.status === 'live' ? 'Review posted. Everyone visiting the site can see it now.' : 'Review saved in this browser.');
    setTimeout(() => this.setState({flash:null}), 1600);
    if (this.state.view === 'detail') requestAnimationFrame(() => { const el = this.reviewsRef.current; if (el) window.scrollTo({top: el.getBoundingClientRect().top + window.scrollY - 76, behavior:'smooth'}); });
  }
  patchReview(id, fn){ this.setState(s => ({reviews: s.reviews.map(r => r.id === id ? Object.assign({}, r, fn(r)) : r)})); }
  async toggleHelpful(id){
    const before = this.state.reviews.find(r => r.id === id); if (!before) return;
    this.patchReview(id, r => ({voted: !r.voted, helpfulCount: r.helpfulCount + (r.voted ? -1 : 1)}));
    try { const out = await this.backend.vote(id); if (typeof out.helpfulCount === 'number') this.patchReview(id, () => ({voted: out.voted, helpfulCount: out.helpfulCount})); }
    catch (err) { this.patchReview(id, () => ({voted: before.voted, helpfulCount: before.helpfulCount})); this.toast(err.message); }
  }
  async report(id){
    this.patchReview(id, () => ({reported: true}));
    try { await this.backend.report(id); this.toast('Reported. A moderator will take a look.'); }
    catch (err) { this.patchReview(id, () => ({reported: false})); this.toast(err.message); }
  }
  async doDelete(){
    const id = this.state.confirmDel; this.setState({confirmDel:null});
    try { await this.backend.remove(id); this.setState(s => ({reviews: s.reviews.filter(r => r.id !== id)})); this.toast('Review deleted'); }
    catch (err) { this.toast(err.message); }
  }

  /* ── view ── */
  render(){
    const s = this.state;
    const loading = s.status === 'loading';
    const stats = {}; R.forEach(r => { const l = s.reviews.filter(x => x.restaurantId === r.id); const n = l.length; const sum = l.reduce((a,x) => a + x.rating, 0); stats[r.id] = {list:l, n, avg: n ? Math.round(sum/n*10)/10 : 0, dist:[5,4,3,2,1].map(k => l.filter(x => x.rating === k).length)}; });
    const mineList = s.reviews.filter(r => r.mine).sort((a,b) => b.createdAt - a.createdAt);
    return html`<div>
      <header className="top"><div className="wrap">
        <button className="brand" onClick=${() => this.go('explore')} aria-label="Plate Index home"><span className="brand-mark">P</span>Plate Index</button>
        <nav className="nav" aria-label="Main">
          <button onClick=${() => this.go('explore')} aria-current=${s.view === 'explore' ? 'page' : undefined}>Explore</button>
          <button onClick=${() => this.go('saved')} aria-current=${s.view === 'saved' ? 'page' : undefined}>Saved <span className="count">${s.saved.length}</span></button>
          <button onClick=${() => this.go('mine')} aria-current=${s.view === 'mine' ? 'page' : undefined}>My reviews <span className="count">${mineList.length}</span></button>
        </nav>
      </div></header>
      ${(s.view === 'explore' || s.view === 'saved') && this.renderList(stats, loading)}
      ${s.view === 'detail' && restById(s.restId) && this.renderDetail(restById(s.restId), stats)}
      ${s.view === 'mine' && this.renderMine(mineList)}
      ${s.form && this.renderForm()}
      ${s.confirmDel && this.renderConfirm()}
      ${s.toast && html`<div className="toast" role="status">${s.toast}</div>`}
    </div>`;
  }

  statusNotice(){
    const s = this.state;
    if (s.status === 'local') return html`<div className="notice" role="note">Shared storage isn’t connected to this deployment yet, so reviews you post are saved in this browser only.</div>`;
    if (s.status === 'error') return html`<div className="notice" role="alert"><span style=${{flex:1}}>Reviews didn’t load. ${s.loadError}</span><button className="btn btn-secondary" onClick=${() => this.refresh()}>Try again</button></div>`;
    if (s.admin) return html`<div className="notice" role="note">Moderator mode: you can delete any review and see how often each was reported.</div>`;
    return null;
  }

  renderList(stats, loading){
    const s = this.state;
    const q = s.search.trim().toLowerCase();
    const filtersActive = !!(q || s.cuisine !== 'All' || s.minRating || s.price || s.vegOnly);
    const clear = () => this.setState({search:'', cuisine:'All', minRating:0, price:0, vegOnly:false});
    let list;
    if (s.view === 'saved') list = s.saved.map(restById).filter(Boolean);
    else {
      list = R.filter(r => (!q || r.name.toLowerCase().includes(q) || r.cuisines.some(c => c.toLowerCase().includes(q)) || r.area.toLowerCase().includes(q))
        && (s.cuisine === 'All' || r.cuisines.includes(s.cuisine))
        && (!s.minRating || (stats[r.id].n && stats[r.id].avg >= s.minRating))
        && (!s.price || r.priceRange === s.price) && (!s.vegOnly || r.isVeg));
      const by = {top:(a,b) => stats[b.id].avg - stats[a.id].avg || stats[b.id].n - stats[a.id].n, reviewed:(a,b) => stats[b.id].n - stats[a.id].n || stats[b.id].avg - stats[a.id].avg, price:(a,b) => a.priceRange - b.priceRange || stats[b.id].avg - stats[a.id].avg, newest:(a,b) => b.addedAt.localeCompare(a.addedAt)};
      list = list.slice().sort(by[s.sort]);
    }
    const isSaved = s.view === 'saved';
    return html`<main className="wrap" style=${{paddingBlock:'28px 72px'}}>
      ${this.statusNotice()}
      ${!isSaved ? html`<div>
        <div className="hero">
          <div>
            <h6 className="kicker" style=${{marginBottom:10}}>Bengaluru · ${R.length} kitchens indexed${loading ? '' : ` · ${s.reviews.length} verdicts`}</h6>
            <h1 className="display">Find a table. Leave a verdict.</h1>
          </div>
          <label className="search">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" aria-hidden="true"><circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.3-4.3"></path></svg>
            <span className="sr">Search restaurants</span>
            <input id="pi-search" type="search" value=${s.search} onChange=${e => this.setState({search:e.target.value})} placeholder="Search by name, cuisine or area" />
          </label>
        </div>
        <div style=${{display:'flex',flexDirection:'column',gap:12,padding:'8px 0 20px'}}>
          <h4>What's on your mind?</h4>
          <div className="rail">
            ${cuisineOpts.slice(1).map(c => { const on = s.cuisine === c; return html`<div className="rail-item" key=${c}>
              <div className=${'rail-disc' + (on ? ' on' : '')}><${Plate} hue=${HUE[c] || 40} word=${c} kind="round" label=${c + ' dishes'} /></div>
              <button className="rail-btn" aria-pressed=${on} onClick=${() => this.setState({cuisine: on ? 'All' : c})}>${c}</button>
            </div>`; })}
          </div>
        </div>
        <div className="filters panel">
          <div><label htmlFor="pi-cuisine" className="label">Cuisine</label>
            <select id="pi-cuisine" className="input" value=${s.cuisine} onChange=${e => this.setState({cuisine:e.target.value})}>${cuisineOpts.map(o => html`<option key=${o} value=${o}>${o}</option>`)}</select></div>
          <div><span className="label" id="pi-minr-l">Min rating</span>
            <div className="seg" role="radiogroup" aria-labelledby="pi-minr-l">${[[0,'Any'],[3,'3+'],[4,'4+'],[4.5,'4.5+']].map(([v,l]) => html`<label className="seg-opt" key=${l}><input type="radio" name="pi-minr" checked=${s.minRating === v} onChange=${() => this.setState({minRating:v})} />${l}</label>`)}</div></div>
          <div><span className="label" id="pi-price-l">Price</span>
            <div className="seg" role="radiogroup" aria-labelledby="pi-price-l">${[[0,'Any'],[1,'₹'],[2,'₹₹'],[3,'₹₹₹']].map(([v,l]) => html`<label className="seg-opt" key=${l}><input type="radio" name="pi-price" checked=${s.price === v} onChange=${() => this.setState({price:v})} />${l}</label>`)}</div></div>
          <div><span className="label">Diet</span>
            <button className="switch" role="switch" aria-checked=${s.vegOnly} onClick=${() => this.setState({vegOnly:!s.vegOnly})}>Veg only<span className="track"><span className="knob"></span></span></button></div>
          <div><label htmlFor="pi-sort" className="label">Sort by</label>
            <select id="pi-sort" className="input" value=${s.sort} onChange=${e => this.setState({sort:e.target.value})}>
              <option value="top">Top rated</option><option value="reviewed">Most reviewed</option><option value="price">Price: low to high</option><option value="newest">Newest</option>
            </select></div>
        </div>
      </div>` : html`<div style=${{paddingBottom:20,borderBottom:'2px solid var(--color-text)'}}>
        <h6 className="kicker" style=${{marginBottom:10}}>Your shortlist</h6>
        <h1 className="display">Saved</h1>
      </div>`}

      <div className="resultbar">
        <span><strong>${list.length}</strong> ${isSaved ? (list.length === 1 ? 'saved restaurant' : 'saved restaurants') : (list.length === 1 ? 'restaurant' : 'restaurants')}</span>
        <span style=${{display:'flex',gap:12,alignItems:'center'}}>
          ${s.status === 'live' && html`<span className="live"><span className="dot"></span>Live reviews</span>`}
          ${!isSaved && filtersActive && html`<button className="btn btn-ghost" onClick=${clear}>Clear filters</button>`}
        </span>
      </div>

      ${list.length > 0 ? html`<div className="grid">${list.map(r => this.renderCard(r, stats[r.id], loading))}</div>`
        : html`<div className="empty panel">
          <h3>${isSaved ? 'Nothing saved yet.' : 'No restaurants match.'}</h3>
          <p className="muted">${isSaved ? 'Tap the bookmark on any restaurant to build a shortlist.' : 'Try a broader search, a lower minimum rating, or clear the filters.'}</p>
          <button className="btn btn-secondary" onClick=${isSaved ? () => this.go('explore') : clear}>${isSaved ? 'Browse restaurants' : 'Clear filters'}</button>
        </div>`}
    </main>`;
  }

  renderCard(r, st, loading){
    const t = tone(st.avg, st.n), oi = openInfo(r.hours), saved = this.state.saved.includes(r.id);
    return html`<article className="card" key=${r.id}>
      <div className="card-media">
        <${Plate} hue=${HUE[r.cuisines[0]] || 40} word=${SIGNATURE[r.id]} label=${r.name} />
        <div className="scrim"></div>
        <span className="media-cap">${r.cuisines.join(' / ')} · ${PRICE_NOTE[r.priceRange]} for two</span>
      </div>
      <button className="card-body" onClick=${() => this.openRest(r.id)} aria-label=${r.name + ', rated ' + (st.n ? st.avg.toFixed(1) : 'none') + ', ' + st.n + ' reviews'}>
        <div className="card-row">
          <span className="card-name">${r.name}</span>
          <span style=${{flex:'none',display:'flex',flexDirection:'column',alignItems:'flex-end',gap:3}}>
            ${loading ? html`<span className="skel skel-card" style=${{width:52,height:26}}></span>`
              : html`<span className="badge" style=${{background:t.bg,color:t.fg}}>${st.n ? st.avg.toFixed(1) : 'New'}<${Star} /></span>`}
            <span style=${{fontSize:11}} className="muted">${loading ? ' ' : st.n + (st.n === 1 ? ' review' : ' reviews')}</span>
          </span>
        </div>
        <div style=${{display:'flex',flexWrap:'wrap',gap:6}}>
          ${r.cuisines.map(c => html`<span className="tag" key=${c}>${c}</span>`)}
          ${r.isVeg && html`<span className="tag tag-outline">Pure veg</span>`}
        </div>
        <div className="card-meta">
          <span><strong style=${{color:'var(--color-text)'}}>${'₹'.repeat(r.priceRange)}</strong><span className="dim">${'₹'.repeat(3 - r.priceRange)}</span></span>
          <span>${r.area}</span>
          <span style=${{display:'inline-flex',alignItems:'center',gap:6,color:'var(--color-text)'}}><span className="dot" style=${{background: oi.open ? 'var(--tone-good)' : 'var(--color-neutral-400)'}}></span>${oi.label}</span>
        </div>
      </button>
      <button className="save-fab" onClick=${e => { e.stopPropagation(); this.toggleSave(r.id); }} aria-label=${saved ? 'Remove ' + r.name + ' from Saved' : 'Save ' + r.name} aria-pressed=${saved}><${Bookmark} on=${saved} /></button>
    </article>`;
  }

  renderDetail(rest, stats){
    const s = this.state, st = stats[rest.id], t = tone(st.avg, st.n), oi = openInfo(rest.hours), saved = s.saved.includes(rest.id), max = Math.max(1, ...st.dist);
    const loading = s.status === 'loading';
    const sorters = {newest:(a,b) => b.createdAt - a.createdAt, highest:(a,b) => b.rating - a.rating || b.createdAt - a.createdAt, lowest:(a,b) => a.rating - b.rating || b.createdAt - a.createdAt, helpful:(a,b) => b.helpfulCount - a.helpfulCount || b.createdAt - a.createdAt};
    const toneFor = k => k >= 4 ? 'var(--tone-good)' : k === 3 ? 'var(--tone-mid)' : 'var(--tone-low)';
    const reviews = st.list.slice().sort(sorters[s.reviewSort]);
    const backLabel = s.prevView === 'saved' ? 'Saved' : s.prevView === 'mine' ? 'My reviews' : 'All restaurants';
    const avgLabel = loading ? '…' : st.n ? st.avg.toFixed(1) : '—';
    const hue = HUE[rest.cuisines[0]] || 40;
    return html`<main className="wrap" style=${{paddingTop:16}}>
      <button className="btn btn-ghost back" onClick=${() => this.go(s.prevView === 'detail' ? 'explore' : s.prevView)}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" aria-hidden="true"><path d="m12 19-7-7 7-7"></path><path d="M19 12H5"></path></svg>${backLabel}
      </button>
      ${this.statusNotice()}
      <div className="dhero">
        <${Plate} hue=${hue} word=${SIGNATURE[rest.id]} label=${rest.name} />
        <div className="scrim"></div>
        <div className="dhero-text">
          <span className="label" style=${{color:'#fff',fontSize:12}}>${rest.cuisines.join(' / ')} · ${rest.area}</span>
          <h1>${rest.name}</h1>
        </div>
        <button className="save-pill" onClick=${() => this.toggleSave(rest.id)} aria-label=${saved ? 'Remove from Saved' : 'Save restaurant'} aria-pressed=${saved}><${Bookmark} size=${18} on=${saved} />${saved ? 'Saved' : 'Save'}</button>
      </div>

      <dl className="facts panel">
        <div><dt className="label">Address</dt><dd>${rest.address}</dd></div>
        <div><dt className="label">Hours</dt><dd style=${{display:'flex',flexDirection:'column'}}><span>${oi.hours}</span><span className="muted" style=${{display:'inline-flex',alignItems:'center',gap:6,fontSize:13}}><span className="dot" style=${{background: oi.open ? 'var(--tone-good)' : 'var(--color-neutral-400)'}}></span>${oi.label}</span></dd></div>
        <div><dt className="label">Price for two</dt><dd><strong>${'₹'.repeat(rest.priceRange)}</strong><span className="dim">${'₹'.repeat(3 - rest.priceRange)}</span> · ${PRICE_NOTE[rest.priceRange]}</dd></div>
        <div><dt className="label">Diet</dt><dd>${rest.isVeg ? 'Pure vegetarian' : 'Veg & non-veg'}</dd></div>
      </dl>

      <div className="cols">
        <aside className="aside">
          <section className="panel" aria-label="Rating breakdown">
            <h6 className="muted">Rating</h6>
            <div style=${{display:'flex',alignItems:'flex-end',gap:16}}>
              <span className="bignum">${avgLabel}</span>
              <div style=${{display:'flex',flexDirection:'column',gap:6,paddingBottom:2}}>
                <span className="verdict" style=${{background:t.bg,color:t.fg}}>${st.n ? WORDS[Math.round(st.avg)] : 'Not rated'}</span>
                <div style=${{display:'flex',gap:2,color:'var(--color-accent)'}} aria-hidden="true">${[1,2,3,4,5].map(i => html`<${Star} key=${i} size=${18} fill=${i <= Math.round(st.avg) ? 'currentColor' : 'none'} />`)}</div>
                <span className="muted" style=${{fontSize:13}}>Based on ${st.n} ${st.n === 1 ? 'review' : 'reviews'}</span>
              </div>
            </div>
            <div className="dist">
              ${[5,4,3,2,1].map((k,i) => html`<div className="dist-row" key=${k} aria-label=${k + ' stars: ' + st.dist[i] + ' reviews'}>
                <span style=${{fontWeight:600}}>${k}★</span>
                <div className="bar"><div style=${{width:(st.dist[i]/max*100) + '%', background:toneFor(k)}}></div></div>
                <span className="muted" style=${{textAlign:'right',fontVariantNumeric:'tabular-nums'}}>${st.dist[i]}</span>
              </div>`)}
            </div>
          </section>
          <section className="panel" aria-label="Popular dishes" style=${{gap:0}}>
            <h6 className="muted" style=${{marginBottom:6}}>Popular dishes</h6>
            <ol className="dishes">
              ${rest.popularDishes.map((n,i) => { const c = st.list.filter(r => r.dishes.includes(n)).length; return html`<li key=${n}>
                <div className="dish-thumb"><${Plate} hue=${hue + i*18} word=${n} kind="tiny" label=${n} /></div>
                <span style=${{fontSize:12,fontWeight:600,color:'var(--color-accent-700)'}}>${String(i+1).padStart(2,'0')}</span>
                <span>${n}</span>
                <span style=${{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:2}}><span style=${{fontWeight:800,fontVariantNumeric:'tabular-nums'}}>${DISH_PRICE[n] ? '₹' + DISH_PRICE[n] : ''}</span><span className="muted" style=${{fontSize:11}}>${c ? c + (c === 1 ? ' mention' : ' mentions') : ''}</span></span>
              </li>`; })}
            </ol>
          </section>
        </aside>

        <section className="rev-col" aria-label="Reviews" ref=${this.reviewsRef}>
          <div className="rev-head">
            <h3>Reviews <span style=${{color:'var(--color-neutral-600)'}}>${st.n}</span></h3>
            <div style=${{display:'flex',alignItems:'center',gap:8}}>
              <label htmlFor="pi-rsort" className="label">Sort</label>
              <select id="pi-rsort" className="input" style=${{width:'auto'}} value=${s.reviewSort} onChange=${e => this.setState({reviewSort:e.target.value})}>
                <option value="newest">Newest first</option><option value="highest">Highest rated</option><option value="lowest">Lowest rated</option><option value="helpful">Most helpful</option>
              </select>
            </div>
          </div>
          ${loading && [1,2].map(k => html`<div key=${k} className="review skel-card"><div className="skel" style=${{height:42,width:'40%'}}></div><div className="skel" style=${{height:14,width:'90%'}}></div><div className="skel" style=${{height:14,width:'70%'}}></div></div>`)}
          ${!loading && st.n === 0 && html`<div style=${{padding:'40px 0',display:'flex',flexDirection:'column',alignItems:'flex-start',gap:10}}>
            <h4>No reviews yet.</h4>
            <p className="muted">Be the first to review ${rest.name}.</p>
            <button className="btn btn-primary" onClick=${() => this.openForm(rest.id, null)}>Write the first review</button>
          </div>`}
          ${reviews.map(r => this.renderReview(r))}
        </section>
      </div>

      <div className="stickybar"><div>
        <span className="name"><strong>${rest.name}</strong> · ${avgLabel}★</span>
        <button className="btn btn-primary cta" onClick=${() => this.openForm(rest.id, null)}>Write a review<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="square" aria-hidden="true"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg></button>
      </div></div>
    </main>`;
  }

  renderReview(r){
    const s = this.state, t = tone(r.rating, 1);
    const canDelete = r.mine || s.admin;
    const flags = s.admin ? (r.reports || 0) : 0;
    return html`<article className=${'review' + (s.flash === r.id ? ' flash' : '')} key=${r.id}>
      <div style=${{display:'flex',gap:12,alignItems:'center'}}>
        <span aria-hidden="true" className=${'avatar' + (r.mine ? ' me' : '')}>${initials(r.authorName)}</span>
        <div style=${{flex:1,minWidth:0,display:'flex',flexDirection:'column'}}>
          <span style=${{fontWeight:600,fontSize:15,overflowWrap:'anywhere'}}>${r.authorName}${r.mine ? ' (you)' : ''}</span>
          <span className="rmeta"><span>${r.visitType}</span><button className="linkish" onClick=${() => this.toast('Posted ' + full(r.createdAt))} title=${full(r.createdAt) + (r.updatedAt ? ' · edited ' + full(r.updatedAt) : '')}>${rel(r.createdAt)}</button>${r.updatedAt ? html`<span>edited</span>` : null}</span>
        </div>
        <span className="badge" style=${{flex:'none',background:t.bg,color:t.fg}} aria-label=${r.rating + ' out of 5 stars'}>${r.rating}<${Star} /></span>
      </div>
      ${r.title && html`<h5 style=${{overflowWrap:'anywhere'}}>${r.title}</h5>`}
      <p className="rtext">${r.text}</p>
      ${r.photos.length > 0 && html`<div style=${{display:'flex',gap:8,flexWrap:'wrap'}}>${r.photos.map((src,i) => html`<img key=${i} className="rphoto" src=${src} alt=${'Photo ' + (i+1) + ' from ' + r.authorName} />`)}</div>`}
      ${r.dishes.length > 0 && html`<div style=${{display:'flex',flexWrap:'wrap',gap:6,alignItems:'center'}}><span className="label">Tried</span>${r.dishes.map(d => html`<span className="tag" key=${d}>${d}</span>`)}</div>`}
      ${r.subRatings && html`<span className="muted" style=${{fontSize:12}}>${SUBS.filter(([k]) => r.subRatings[k]).map(([k,l]) => l + ' ' + r.subRatings[k]).join('  ·  ')}</span>`}
      ${flags > 0 && html`<span className="flagged">Reported by ${flags} ${flags === 1 ? 'person' : 'people'}</span>`}
      <div style=${{display:'flex',flexWrap:'wrap',gap:'4px 8px',alignItems:'center',marginTop:2}}>
        <button className="helpful" onClick=${() => this.toggleHelpful(r.id)} disabled=${r.mine} aria-pressed=${!!r.voted} title=${r.mine ? 'You can’t vote on your own review' : r.voted ? 'Remove your helpful vote' : 'Mark as helpful'}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M7 10v12"></path><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z"></path></svg>Helpful · ${r.helpfulCount}
        </button>
        ${r.mine && html`<button className="btn btn-ghost btn-ink" onClick=${() => this.openForm(r.restaurantId, r)} style=${{minHeight:40}}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"></path></svg>Edit</button>`}
        ${canDelete && html`<button className="btn btn-ghost" onClick=${() => this.setState({confirmDel:r.id})} style=${{minHeight:40}}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>Delete</button>`}
        <button className="report" onClick=${() => this.report(r.id)} disabled=${!!r.reported} aria-label=${r.reported ? 'Review reported' : 'Report review by ' + r.authorName}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><line x1="4" x2="4" y1="22" y2="15"></line></svg>${r.reported ? 'Reported' : 'Report'}
        </button>
      </div>
    </article>`;
  }

  renderMine(mineList){
    const s = this.state;
    return html`<main className="wrap" style=${{maxWidth:860,paddingBlock:'28px 72px'}}>
      ${this.statusNotice()}
      <div style=${{paddingBottom:20,borderBottom:'2px solid var(--color-text)'}}>
        <h6 className="kicker" style=${{marginBottom:10}}>Signed as ${s.myName || 'guest'}</h6>
        <h1 className="display">My reviews</h1>
      </div>
      ${mineList.length === 0 && html`<div style=${{padding:'48px 0',display:'flex',flexDirection:'column',alignItems:'flex-start',gap:12}}>
        <h3>Nothing written yet.</h3>
        <p className="muted">Open any restaurant and leave a rating. It takes under thirty seconds. Reviews are tied to this browser, so you can edit them from here later.</p>
        <button className="btn btn-secondary" onClick=${() => this.go('explore')}>Browse restaurants</button>
      </div>`}
      ${mineList.map(r => { const t = tone(r.rating, 1), rr = restById(r.restaurantId); return html`<article className="mine panel" key=${r.id}>
        <span className="badge" style=${{background:t.bg,color:t.fg}}>${r.rating}★</span>
        <div style=${{display:'flex',flexWrap:'wrap',justifyContent:'space-between',gap:'4px 12px',alignItems:'baseline'}}>
          <button className="mine-name" onClick=${() => this.openRest(r.restaurantId)}>${rr ? rr.name : 'Unknown'}</button>
          <span title=${full(r.createdAt)} className="muted" style=${{fontSize:12}}>${rel(r.createdAt)} · ${r.visitType}</span>
        </div>
        <p style=${{fontSize:15,textWrap:'pretty',overflowWrap:'anywhere'}}>${r.title && html`<strong>${r.title} — </strong>`}${r.text.length > 220 ? r.text.slice(0,220) + '…' : r.text}</p>
        <div style=${{display:'flex',gap:8}}>
          <button className="btn btn-secondary" onClick=${() => this.openForm(r.restaurantId, r)} style=${{minHeight:40}}>Edit</button>
          <button className="btn btn-ghost" onClick=${() => this.setState({confirmDel:r.id})} style=${{minHeight:40}}>Delete</button>
        </div>
      </article>`; })}
    </main>`;
  }

  renderForm(){
    const f = this.state.form, fr = restById(f.restId);
    const shown = f.hover || f.rating, len = f.text.trim().length, ok = this.canSubmit(f);
    const textErr = (f.tried || f.blurText) && len < 10;
    const nameErr = (f.tried || f.blurName) && !f.name.trim();
    const onStarKey = e => { const cur = this.state.form.rating || 0; let v;
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') v = Math.min(5, cur + 1); else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') v = Math.max(1, cur - 1); else if (e.key === 'Home') v = 1; else if (e.key === 'End') v = 5; else return;
      e.preventDefault(); this.patchForm({rating:v, hover:0}); requestAnimationFrame(() => { const b = this.starRef.current && this.starRef.current.querySelectorAll('button')[v-1]; b && b.focus(); }); };
    const submitHint = ok ? (this.state.status === 'live' ? 'Posts publicly under the name above.' : 'Saves in this browser under the name above.') : !f.rating && len < 10 ? 'Add a star rating and at least 10 characters to post.' : !f.rating ? 'Add a star rating to post.' : len < 10 ? 'Write at least 10 characters to post.' : 'Add your name to post.';
    const close = () => this.setState({form:null});
    return html`<div className="backdrop" onClick=${close}>
      <form className="dialog" role="dialog" aria-modal="true" aria-labelledby="pi-form-title" onClick=${e => e.stopPropagation()} onSubmit=${e => this.submit(e)} noValidate>
        <div style=${{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:12}}>
          <div>
            <h6 className="kicker" style=${{marginBottom:6}}>${f.editId ? 'Edit your review' : 'Write a review'}</h6>
            <h2 id="pi-form-title" style=${{fontSize:'clamp(24px,5vw,32px)'}}>${fr ? fr.name : ''}</h2>
          </div>
          <button type="button" className="btn btn-secondary" onClick=${close} aria-label="Close" style=${{width:44,height:44,padding:0,flex:'none'}}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg></button>
        </div>

        <div className="rule2" style=${{display:'flex',flexDirection:'column',gap:8}}>
          <span id="pi-rating-label" style=${{fontSize:12,fontWeight:600}}>Overall rating <span className="req">*</span></span>
          <div style=${{display:'flex',flexWrap:'wrap',alignItems:'center',gap:'8px 16px'}}>
            <div ref=${this.starRef} role="radiogroup" aria-labelledby="pi-rating-label" onKeyDown=${onStarKey} onMouseLeave=${() => this.patchForm({hover:0})} style=${{display:'flex',gap:2}}>
              ${[1,2,3,4,5].map(i => { const on = i <= shown; return html`<button type="button" key=${i} className="starbtn" role="radio" aria-checked=${f.rating === i} aria-label=${i + (i > 1 ? ' stars' : ' star') + ' — ' + WORDS[i]} tabIndex=${(f.rating ? f.rating === i : i === 1) ? 0 : -1}
                onClick=${() => this.patchForm({rating:i})} onMouseEnter=${() => this.patchForm({hover:i})} onFocus=${() => this.patchForm({hover:i})} onBlur=${() => this.patchForm({hover:0})} style=${{color: on ? 'var(--color-accent)' : 'var(--color-neutral-500)'}}>
                <${Star} size=${38} sw=${1.6} fill=${on ? 'var(--color-accent)' : 'none'} style=${{transform: on ? 'scale(1.06)' : 'scale(0.9)'}} />
              </button>`; })}
            </div>
            <span aria-live="polite" style=${{fontFamily:'var(--font-heading)',fontWeight:800,fontSize:18}}>${shown ? WORDS[shown] : 'Tap a star'}</span>
          </div>
          ${f.tried && !f.rating && html`<span role="alert" className="err">Choose a star rating. Tap a star or use the arrow keys.</span>`}
        </div>

        <div style=${{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,220px),1fr))',gap:16}}>
          <div className="field">
            <label htmlFor="pi-name">Your name <span className="req">*</span></label>
            <input id="pi-name" className="input" value=${f.name} onChange=${e => this.patchForm({name:e.target.value})} onBlur=${() => this.patchForm({blurName:true})} maxLength="60" autoComplete="name" aria-invalid=${nameErr} />
            ${nameErr && html`<span role="alert" className="err">Add your name so others know who's talking.</span>`}
          </div>
          <div className="field">
            <label htmlFor="pi-title">Title <span className="opt">(optional)</span></label>
            <input id="pi-title" className="input" value=${f.title} onChange=${e => this.patchForm({title:e.target.value})} maxLength="100" placeholder="Sum it up in a line" />
          </div>
        </div>

        <div className="field">
          <div style=${{display:'flex',justifyContent:'space-between',alignItems:'baseline'}}><label htmlFor="pi-text">Your review <span className="req">*</span></label><span aria-live="polite" style=${{fontSize:12,fontVariantNumeric:'tabular-nums',color: f.text.length > 950 ? 'var(--color-accent-700)' : 'var(--color-neutral-700)'}}>${f.text.length} / 1000</span></div>
          <textarea id="pi-text" className="input" value=${f.text} onChange=${e => this.patchForm({text:e.target.value.slice(0,1000)})} onBlur=${() => this.patchForm({blurText:true})} maxLength="1000" rows="5" aria-invalid=${textErr} aria-describedby="pi-text-hint" placeholder="What did you eat? How was the service? Would you go back?"></textarea>
          <span id="pi-text-hint" style=${{fontSize:13,color: textErr ? 'var(--color-accent-700)' : 'var(--color-neutral-700)'}}>${textErr ? 'Write at least 10 characters. ' + (10 - len) + ' to go.' : len < 10 ? 'Minimum 10 characters.' : 'Looks good.'}</span>
        </div>

        <div style=${{display:'flex',flexDirection:'column',gap:6}}>
          <span className="flabel" id="pi-visit-l">Visit type</span>
          <div className="seg" role="radiogroup" aria-labelledby="pi-visit-l" style=${{maxWidth:420}}>${VISITS.map(v => html`<label className="seg-opt" key=${v} style=${{minHeight:44}}><input type="radio" name="pi-visit" checked=${f.visitType === v} onChange=${() => this.patchForm({visitType:v})} />${v}</label>`)}</div>
        </div>

        <div style=${{display:'flex',flexDirection:'column',gap:6}}>
          <span className="flabel">Dishes you tried <span className="opt">(optional)</span></span>
          <div style=${{display:'flex',flexWrap:'wrap',gap:6}}>${(fr ? fr.popularDishes : []).map(n => { const on = f.dishes.includes(n); return html`<button type="button" key=${n} className="chip" aria-pressed=${on} onClick=${() => this.patchForm({dishes: on ? f.dishes.filter(x => x !== n) : f.dishes.concat(n)})}>${n}</button>`; })}</div>
        </div>

        <div style=${{display:'flex',flexDirection:'column',gap:6}}>
          <span className="flabel">Rate the details <span className="opt">(optional)</span></span>
          <div className="subrows">${SUBS.map(([k,l]) => html`<div className="subrow" key=${k}>
            <span>${l}</span>
            <div role="group" aria-label=${l + ' rating'} style=${{display:'flex'}}>${[1,2,3,4,5].map(i => { const on = i <= f.sub[k]; return html`<button type="button" key=${i} className="substar" aria-label=${l + ' ' + i + ' of 5'} aria-pressed=${f.sub[k] === i} onClick=${() => this.patchForm({sub: Object.assign({}, f.sub, {[k]: f.sub[k] === i ? 0 : i})})} style=${{color: on ? 'var(--color-text)' : 'var(--color-neutral-500)'}}><${Star} size=${20} sw=${1.8} fill=${on ? 'var(--color-text)' : 'none'} /></button>`; })}</div>
          </div>`)}</div>
        </div>

        <div style=${{display:'flex',flexDirection:'column',gap:8}}>
          <span className="flabel">Photos <span className="opt">(up to 3)</span></span>
          <div style=${{display:'flex',flexWrap:'wrap',gap:8}}>
            ${f.photos.map((src,i) => html`<div className="fphoto" key=${i}><img src=${src} alt=${'Your photo ' + (i+1)} /><button type="button" onClick=${() => this.patchForm({photos: f.photos.filter((_,j) => j !== i)})} aria-label=${'Remove photo ' + (i+1)}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg></button></div>`)}
            ${f.photos.length < 3 && html`<label className="addphoto">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M16 5h6"></path><path d="M19 2v6"></path><path d="M21 11.5V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7.5"></path><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"></path><circle cx="9" cy="9" r="2"></circle></svg>Add photo
              <input id="pi-photos" type="file" accept="image/*" multiple onChange=${e => this.addPhotos(e)} />
            </label>`}
          </div>
        </div>

        <div className="rule2" style=${{display:'flex',flexWrap:'wrap',alignItems:'center',gap:12}}>
          <span className="muted" style=${{flex:'1 1 200px',fontSize:13}}>${submitHint}</span>
          <button type="button" className="btn btn-secondary" onClick=${close} style=${{minHeight:48}}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled=${!ok || f.saving} style=${{minHeight:48,minWidth:180,justifyContent:'flex-start',fontSize:15}}>${f.saving ? 'Saving…' : f.editId ? 'Save changes' : 'Post review'}</button>
        </div>
      </form>
    </div>`;
  }

  renderConfirm(){
    const r = this.state.reviews.find(x => x.id === this.state.confirmDel); if (!r) return null;
    const cancel = () => this.setState({confirmDel:null});
    return html`<div className="backdrop center" onClick=${cancel}>
      <div className="dialog small" role="alertdialog" aria-modal="true" aria-labelledby="pi-del-title" onClick=${e => e.stopPropagation()}>
        <div id="pi-del-title" style=${{fontFamily:'var(--font-heading)',fontWeight:800,fontSize:20}}>Delete this review?</div>
        <div style=${{fontSize:14}}>${r.mine ? 'Your' : r.authorName + '’s'} rating for ${(restById(r.restaurantId) || {}).name} will be removed for everyone and the average recalculated. This can't be undone.</div>
        <div className="dialog-actions">
          <button className="btn btn-secondary" onClick=${cancel}>Keep it</button>
          <button className="btn btn-primary" onClick=${() => this.doDelete()}>Delete review</button>
        </div>
      </div>
    </div>`;
  }
}

createRoot(document.getElementById('app')).render(html`<${App} />`);
