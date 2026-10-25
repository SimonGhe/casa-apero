export function TeamPhoto() {
  return <figure className="team-photo">
    <img
      src="/assets/team.webp"
      srcSet="/assets/team-640.webp 640w, /assets/team.webp 1179w"
      sizes="(min-width: 1200px) 540px, (min-width: 768px) 45vw, calc(100vw - 48px)"
      alt="Het team achter Casa Apero"
      width={1179} height={984}
      loading="lazy" decoding="async"
    />
  </figure>;
}
