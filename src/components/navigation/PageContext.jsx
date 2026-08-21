import './page-context.css';

export function PageContext({ eyebrow, title, description, actions }) {
  return (
    <header className="page-context">
      <div className="page-context__copy">
        {eyebrow ? <p className="page-context__eyebrow">{eyebrow}</p> : null}
        <h1 className="page-context__title">{title}</h1>
        {description ? <p className="page-context__description">{description}</p> : null}
      </div>

      {actions ? <div className="page-context__actions">{actions}</div> : null}
    </header>
  );
}
