import { useState } from 'react';

// Campo de contraseña con botón para mostrar/ocultar lo que se escribe.
// Acepta los mismos props que un <input> normal (id, name, value, onChange,
// required, minLength, placeholder, autoComplete…).
export default function PasswordInput({ className, ...props }) {
  const [show, setShow] = useState(false);
  const label = show ? 'Ocultar contraseña' : 'Mostrar contraseña';

  return (
    <div className="password-field">
      <input {...props} type={show ? 'text' : 'password'} className={className} />
      <button
        type="button"
        className="password-toggle"
        onClick={() => setShow((s) => !s)}
        aria-label={label}
        title={label}
      >
        {show ? '🙈' : '👁'}
      </button>
    </div>
  );
}
