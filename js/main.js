'use strict';
/* ============================================================
   main.js · Comportamiento interactivo de 80 SMART
   1. Menú móvil (#menuToggle -> #menuPrincipal.activo / .abierto)
   2. Intercambio entre inicio de sesión y registro (#authCard)
   3. Validación de formularios (#formLogin, #formRegistro y #formContacto)
   ============================================================ */

document.addEventListener('DOMContentLoaded', function () {
  activarFondo3D();
  activarMenu();
  validarLogin();
  validarContacto();
});

/* ---------- 0. Fondo geométrico 3D con paralaje ambiental ---------- */
function activarFondo3D() {
  if (document.querySelector('.geo-backdrop')) return;
  const isAuth = !!document.getElementById('authCard');
  const host = document.createElement('div');
  host.className = 'geo-backdrop' + (isAuth ? '' : ' geo-subtle');
  host.setAttribute('aria-hidden', 'true');
  host.innerHTML =
    '<div class="geo-light geo-light-a"></div>' +
    '<div class="geo-light geo-light-b"></div>' +
    '<div class="geo-light geo-light-c"></div>' +
    '<div class="geo-parallax geo-parallax-far"><div class="geo-layer geo-layer-far"><div class="geo-slab geo-slab-1"></div><div class="geo-slab geo-slab-2"></div><div class="geo-slab geo-slab-3"></div></div></div>' +
    '<div class="geo-parallax geo-parallax-mid"><div class="geo-layer geo-layer-mid"><div class="geo-slab geo-slab-4"></div><div class="geo-slab geo-slab-5"></div><div class="geo-slab geo-slab-6"></div></div></div>' +
    '<div class="geo-parallax geo-parallax-near"><div class="geo-layer geo-layer-near"><div class="geo-slab geo-slab-7"></div><div class="geo-slab geo-slab-8"></div></div></div>' +
    '<div class="geo-sheen"></div>' +
    '<div class="geo-vignette"></div>';
  document.body.prepend(host);

  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  let tx = 0, ty = 0, cx = 0, cy = 0, raf = 0;
  function tick() {
    cx += (tx - cx) * 0.045;
    cy += (ty - cy) * 0.045;
    host.style.setProperty('--px', cx.toFixed(4));
    host.style.setProperty('--py', cy.toFixed(4));
    if (Math.abs(tx - cx) > 0.001 || Math.abs(ty - cy) > 0.001) {
      raf = requestAnimationFrame(tick);
    } else {
      raf = 0;
    }
  }
  window.addEventListener('pointermove', function (e) {
    if (e.pointerType !== 'mouse') return;
    tx = (e.clientX / window.innerWidth - 0.5) * 2;
    ty = (e.clientY / window.innerHeight - 0.5) * 2;
    if (!raf) tick();
  }, { passive: true });
}

/* ---------- 1. Menú hamburguesa (móvil) ---------- */
function activarMenu() {
  const boton = document.getElementById('menuToggle');
  const menu = document.getElementById('menuPrincipal');

  if (boton && menu) {
    boton.addEventListener('click', function () {
      menu.classList.toggle('activo');
      menu.classList.toggle('abierto');
    });
  }
}

/* ---------- 2. Intercambio deslizante Login <-> Registro ---------- */
function activarIntercambioAuth() {
  const card = document.getElementById('authCard');
  const btnIrRegistro = document.getElementById('btnIrRegistro');
  const btnIrLogin = document.getElementById('btnIrLogin');
  const btnOverlayRegister = document.getElementById('btnOverlayRegister');
  const btnOverlayLogin = document.getElementById('btnOverlayLogin');

  if (!card) return;

  function cambiarModo(modoRegistro) {
    card.classList.toggle('mode-register', modoRegistro);
  }

  [btnIrRegistro, btnOverlayRegister].forEach(function (btn) {
    if (!btn) return;
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      cambiarModo(true);
    });
  });

  [btnIrLogin, btnOverlayLogin].forEach(function (btn) {
    if (!btn) return;
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      cambiarModo(false);
    });
  });

  if (location.hash === '#registro') cambiarModo(true);
}

/* ---------- 3. Utilidades de validación ---------- */
const patronCorreo = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function mostrarErrorCampo(idElemento, texto) {
  const el = document.getElementById(idElemento);
  if (el) el.textContent = texto;
}

function mostrarEstadoFormulario(idElemento, texto, tipo) {
  const caja = document.getElementById(idElemento);
  if (!caja) return;
  caja.textContent = texto;
  caja.className = 'mensaje-form ' + tipo;
}

/* ---------- 4. Validación de #formLogin ---------- */
function validarLogin() {
  const formulario = document.getElementById('formLogin');
  if (!formulario) return;

  const inputCorreo = document.getElementById('correoLogin');
  const inputClave = document.getElementById('claveLogin');

  formulario.addEventListener('submit', function (e) {
    e.preventDefault();
    let valido = true;

    const correo = inputCorreo ? inputCorreo.value.trim() : '';
    const clave = inputClave ? inputClave.value : '';

    if (!correo || !patronCorreo.test(correo)) {
      mostrarErrorCampo('errorCorreo', 'Escribe un correo electrónico corporativo válido.');
      valido = false;
    } else {
      mostrarErrorCampo('errorCorreo', '');
    }

    if (!clave || clave.length < 6) {
      mostrarErrorCampo('errorClave', 'La contraseña debe tener mínimo 6 caracteres.');
      valido = false;
    } else {
      mostrarErrorCampo('errorClave', '');
    }

    if (valido) {
      const caja = document.getElementById('mensajeLogin');
      if (caja) {
        caja.className = 'mensaje-form exito';
        caja.innerHTML = 'Credenciales validadas. <a href="sistema.html" style="font-weight:700;text-decoration:underline;">Abrir Sistema 80 SMART →</a>';
      }
    } else {
      mostrarEstadoFormulario('mensajeLogin', 'Por favor corrige los campos marcados antes de ingresar.', 'error');
    }
  });
}

/* ---------- 5. Validación de #formRegistro ---------- */
function validarRegistro() {
  const formulario = document.getElementById('formRegistro');
  if (!formulario) return;

  formulario.addEventListener('submit', function (e) {
    e.preventDefault();
    const nombre = (document.getElementById('nombreRegistro')?.value || '').trim();
    const correo = (document.getElementById('correoRegistro')?.value || '').trim();
    const clave = document.getElementById('claveRegistro')?.value || '';

    if (nombre.length < 3 || !patronCorreo.test(correo) || clave.length < 8) {
      mostrarEstadoFormulario('mensajeRegistro', 'Completa nombre, correo válido y contraseña de mínimo 8 caracteres.', 'error');
      return;
    }
    const caja = document.getElementById('mensajeRegistro');
    if (caja) {
      caja.className = 'mensaje-form exito';
      caja.innerHTML = 'Cuenta preparada. <a href="sistema.html#/register" style="font-weight:700;text-decoration:underline;">Finalizar registro en 80 SMART →</a>';
    }
  });
}

/* ---------- 6. Validación de #formContacto ---------- */
function validarContacto() {
  const formulario = document.getElementById('formContacto');
  if (!formulario) return;

  const inputNombre = document.getElementById('nombreContacto');
  const inputCorreo = document.getElementById('correoContacto');
  const selectAsunto = document.getElementById('asuntoContacto');
  const inputMensaje = document.getElementById('mensajeContactoTxt');

  formulario.addEventListener('submit', function (e) {
    e.preventDefault();
    let valido = true;

    const nombre = inputNombre ? inputNombre.value.trim() : '';
    const correo = inputCorreo ? inputCorreo.value.trim() : '';
    const asunto = selectAsunto ? selectAsunto.value.trim() : '';
    const mensaje = inputMensaje ? inputMensaje.value.trim() : '';

    if (nombre.length < 3) {
      mostrarErrorCampo('errorNombreContacto', 'Escribe tu nombre completo (mínimo 3 caracteres).');
      valido = false;
    } else {
      mostrarErrorCampo('errorNombreContacto', '');
    }

    if (!correo || !patronCorreo.test(correo)) {
      mostrarErrorCampo('errorCorreoContacto', 'Escribe un correo válido con @ y dominio.');
      valido = false;
    } else {
      mostrarErrorCampo('errorCorreoContacto', '');
    }

    if (!asunto) {
      mostrarErrorCampo('errorAsuntoContacto', 'Selecciona el motivo de tu consulta.');
      valido = false;
    } else {
      mostrarErrorCampo('errorAsuntoContacto', '');
    }

    if (mensaje.length < 10) {
      mostrarErrorCampo('errorMensajeContacto', 'El mensaje debe tener mínimo 10 caracteres.');
      valido = false;
    } else {
      mostrarErrorCampo('errorMensajeContacto', '');
    }

    if (valido) {
      mostrarEstadoFormulario('mensajeContacto', 'Gracias por escribirnos. Nuestro equipo de soporte 80 SMART te responderá pronto.', 'exito');
      formulario.reset();
    } else {
      mostrarEstadoFormulario('mensajeContacto', 'Revisa los campos marcados en rojo para enviar tu mensaje.', 'error');
    }
  });
}
