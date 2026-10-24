import type {AuditRow} from '../../shared/admin';
export function AuditRows({rows}:{rows:AuditRow[]}){
 return <ul className="admin-audit">{rows.map(row=><li key={row.id}><strong>{row.action}</strong> · {new Date(row.created_at).toLocaleString('nl-BE',{timeZone:'Europe/Brussels'})}<p>{row.actor_id} · {row.entity_type}</p><details><summary>Wijziging bekijken</summary><p>Voor</p><pre>{row.before_json}</pre><p>Na</p><pre>{row.after_json}</pre></details></li>)}</ul>;
}
