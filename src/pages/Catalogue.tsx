import { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import {useCatalogue} from '../context/CatalogueContext';
import { ProductCard } from '../components/ProductCard';

export function Catalogue() {
  const {products}=useCatalogue();
  const [category, setCategory] = useState('Alles');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('default');
  const filtered = useMemo(() => products.filter((p) =>
    (category === 'Alles' || p.category === category) && `${p.name} ${p.description} ${p.typeLabel}`.toLocaleLowerCase('nl').includes(query.trim().toLocaleLowerCase('nl')),
  ).sort((a, b) => {
    const difference = Math.min(...a.variants.map((v) => v.priceCents)) - Math.min(...b.variants.map((v) => v.priceCents));
    return sort === 'asc' ? difference : sort === 'desc' ? -difference : 0;
  }), [products,category, query, sort]);

  return <div className="content-width page-space">
    <p className="eyebrow">Handgemaakt op bestelling</p><h1 className="page-title">De collectie</h1>
    <p className="page-intro">Handgemaakte potjes en aperoschalen voor een tafel vol gezelligheid. Ontdek onze actuele collectie hieronder.</p>
    <p className="notice">De foto's tonen onze eigen handgemaakte producten. Kleine verschillen in vorm, kleur en glazuur horen bij handwerk. Op sommige foto's zie je meerdere stukken samen.</p>
    <div className="catalogue-toolbar">
      <div className="segmented-control" role="group" aria-label="Filter op productsoort">{['Alles', 'Kommetjes', 'Aperoschalen'].map((value) => <button type="button" key={value} aria-pressed={category === value} onClick={() => setCategory(value)}>{value}</button>)}</div>
      <div className="catalogue-controls">
        <label className="search-field"><Search size={17} aria-hidden="true" /><input aria-label="Zoek in de collectie" placeholder="Zoek een kommetje" value={query} onChange={(e) => setQuery(e.target.value)} />{query && <button className="icon-button" type="button" title="Zoekopdracht wissen" aria-label="Zoekopdracht wissen" onClick={() => setQuery('')}><X size={16} aria-hidden="true" /></button>}</label>
        <label className="sort-field"><span className="sr-only">Sorteer collectie</span><select aria-label="Sorteer collectie" value={sort} onChange={(e) => setSort(e.target.value)}><option value="default">Standaard volgorde</option><option value="asc">Prijs: laag naar hoog</option><option value="desc">Prijs: hoog naar laag</option></select></label>
      </div>
    </div>
    <p className="result-count" role="status">{filtered.length} {filtered.length === 1 ? 'product' : 'producten'}</p>
    {filtered.length ? <div className="product-grid catalogue-grid">{filtered.map((product) => <ProductCard key={product.id} product={product} />)}</div> : <div className="empty-state"><Search size={32} aria-hidden="true" /><h2>Geen kommetjes gevonden</h2><p>Probeer een andere zoekterm of bekijk de hele collectie.</p><button className="button button-primary" type="button" onClick={() => { setQuery(''); setCategory('Alles'); }}>Toon alle producten</button></div>}
    <div className="catalogue-footnote"><h2>Elk kommetje begint bij jouw bestelling.</h2><p>We maken alles met de hand. De productpagina toont de actuele geschatte productietijd; dit is geen gegarandeerde deadline. Staat een product tijdelijk op pauze? Dan nemen we daarvoor even geen nieuwe bestellingen aan.</p></div>
  </div>;
}
