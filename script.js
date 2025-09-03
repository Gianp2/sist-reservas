// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyD0dfRMXPv35Qpe54P3xezjt4OAACM9Flc",
  authDomain: "peluqueriambs.firebaseapp.com",
  projectId: "peluqueriambs",
  storageBucket: "peluqueriambs.firebasestorage.app",
  messagingSenderId: "687777736494",
  appId: "1:687777736494:web:e2ea7be639eaafee2a3cbf",
  measurementId: "G-XKS6MYTM3L"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

// Habilitar modo de depuración de Firestore para ver detalles de errores
firebase.firestore.setLogLevel('debug');

// Horarios
const horariosManana = ["09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00", "12:30"];
const horariosTarde = ["15:00", "15:30", "16:00", "16:30", "17:00", "17:30", "18:00", "18:30", "19:00", "19:30", "20:00", "20:30"];
const horarios = [...horariosManana, ...horariosTarde];
const diasHabilitados = [2, 3, 4, 5, 6]; // Martes a sábado

// Parsear fecha desde DD/MM/YYYY o YYYY-MM-DD a Date
function parseDMY(dateStr) {
  if (!dateStr) return null;
  if (dateStr.includes("/")) {
    const [day, month, year] = dateStr.split("/").map(Number);
    return new Date(year, month - 1, day);
  }
  if (dateStr.includes("-")) {
    const [year, month, day] = dateStr.split("-").map(Number);
    return new Date(year, month - 1, day);
  }
  return null;
}

// Formatear fecha a DD/MM/YYYY
function formatDate(dateStr) {
  if (!dateStr) return "";
  let date;
  if (dateStr.includes("-")) {
    const [year, month, day] = dateStr.split("-").map(Number);
    date = new Date(year, month - 1, day);
  } else if (dateStr.includes("/")) {
    const [day, month, year] = dateStr.split("/").map(Number);
    date = new Date(year, month - 1, day);
  } else {
    return "";
  }
  if (isNaN(date)) return "";
  return `${date.getDate().toString().padStart(2, "0")}/${(date.getMonth() + 1).toString().padStart(2, "0")}/${date.getFullYear()}`;
}

// Formatear fecha a YYYY-MM-DD
function formatDateToISO(date) {
  if (!(date instanceof Date) || isNaN(date)) return "";
  return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, "0")}-${date.getDate().toString().padStart(2, "0")}`;
}

// Obtener turnos desde Firestore
async function obtenerTurnos() {
  try {
    console.log("Obteniendo turnos...");
    const querySnapshot = await db.collection("turnos").get();
    const turnos = [];
    querySnapshot.forEach((doc) => {
      turnos.push({ id: doc.id, ...doc.data() });
    });
    console.log("Turnos obtenidos:", turnos);
    return turnos;
  } catch (error) {
    console.error("Error al obtener turnos: ", error.code, error.message);
    Swal.fire({
      icon: "error",
      title: "Error",
      text: "No se pudieron cargar los turnos. Inténtalo de nuevo.",
      confirmButtonColor: "#facc15"
    });
    return [];
  }
}

// Escuchar turnos en tiempo real
function escucharTurnos(callback, selectedDate = "") {
  console.log("Iniciando escucha de turnos para fecha:", selectedDate);
  let query = db.collection("turnos");
  if (selectedDate) {
    const formattedSelectedDate = formatDate(selectedDate);
    query = query.where("fecha", "==", formattedSelectedDate);
  }
  query.onSnapshot((snapshot) => {
    console.log("Snapshot recibido, documentos:", snapshot.size);
    const turnos = [];
    snapshot.forEach((doc) => {
      turnos.push({ id: doc.id, ...doc.data() });
    });
    callback(turnos);
  }, (error) => {
    console.error("Error al escuchar turnos: ", error.code, error.message);
    Swal.fire({
      icon: "error",
      title: "Error",
      text: "No se pudieron cargar los turnos en tiempo real. Inténtalo de nuevo.",
      confirmButtonColor: "#facc15"
    });
  });
}

// Guardar turno en Firestore
async function guardarTurno(turno) {
  try {
    console.log("Guardando turno:", turno);
    const docRef = await db.collection("turnos").add(turno);
    console.log("Turno guardado con ID: ", docRef.id);
  } catch (error) {
    console.error("Error al guardar turno: ", error.code, error.message);
    Swal.fire({
      icon: "error",
      title: "Error",
      text: "No se pudo guardar el turno. Inténtalo de nuevo.",
      confirmButtonColor: "#facc15"
    });
  }
}

// Generar turnos para una fecha específica
async function generarTurnos() {
  if (!auth.currentUser || auth.currentUser.isAnonymous) {
    Swal.fire({
      icon: "error",
      title: "Error",
      text: "Debes iniciar sesión como administrador para generar turnos.",
      confirmButtonColor: "#facc15"
    });
    return;
  }

  const fechaGenerar = document.getElementById("fechaGenerar").value;
  if (!fechaGenerar) {
    Swal.fire({
      icon: "warning",
      title: "Falta fecha",
      text: "Por favor, selecciona una fecha para generar los turnos.",
      confirmButtonColor: "#facc15"
    });
    return;
  }

  const selectedDate = parseDMY(fechaGenerar);
  if (!selectedDate || isNaN(selectedDate)) {
    Swal.fire({
      icon: "warning",
      title: "Fecha inválida",
      text: "Por favor, selecciona una fecha válida.",
      confirmButtonColor: "#facc15"
    });
    return;
  }

  if (!diasHabilitados.includes(selectedDate.getDay())) {
    Swal.fire({
      icon: "warning",
      title: "Día no laborable",
      text: "Por favor, selecciona un día laborable (martes a sábado).",
      confirmButtonColor: "#facc15"
    });
    return;
  }

  const turnos = await obtenerTurnos();
  const formattedDate = formatDate(fechaGenerar);
  const turnosExistentes = new Set(turnos
    .filter(t => t.fecha === formattedDate)
    .map(t => t.hora));

  const nuevosTurnos = [];
  for (const hora of horarios) {
    if (!turnosExistentes.has(hora)) {
      nuevosTurnos.push({
        fecha: formattedDate,
        hora: hora,
        Disponible: "Sí",
        nombre: "",
        telefono: ""
      });
    }
  }

  if (nuevosTurnos.length === 0) {
    Swal.fire({
      icon: "info",
      title: "Sin turnos nuevos",
      text: `Todos los turnos para ${formattedDate} ya están generados.`,
      confirmButtonColor: "#facc15"
    });
    return;
  }

  for (const turno of nuevosTurnos) {
    await guardarTurno(turno);
  }

  Swal.fire({
    icon: "success",
    title: "Turnos generados",
    text: `Se generaron ${nuevosTurnos.length} turnos para ${formattedDate} correctamente.`,
    timer: 2000,
    showConfirmButton: false
  });
  document.getElementById("fechaGenerar").value = "";
}

// Eliminar turno
async function deleteTurno(id) {
  if (!auth.currentUser || auth.currentUser.isAnonymous) {
    Swal.fire({
      icon: "error",
      title: "Error",
      text: "Debes iniciar sesión como administrador para realizar esta acción.",
      confirmButtonColor: "#facc15"
    });
    return;
  }

  if (!id) {
    console.error("ID de turno inválido o no proporcionado:", id);
    Swal.fire({
      icon: "error",
      title: "Error",
      text: "ID de turno inválido. No se pudo eliminar el turno.",
      confirmButtonColor: "#facc15"
    });
    return;
  }
  try {
    console.log("Intentando eliminar turno con ID:", id);
    const turnoRef = db.collection("turnos").doc(id);
    const doc = await turnoRef.get();
    if (!doc.exists) {
      console.error("El turno no existe en Firestore, ID:", id);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "El turno no existe. No se pudo eliminar.",
        confirmButtonColor: "#facc15"
      });
      return;
    }
    await turnoRef.delete();
    console.log("Turno eliminado con éxito, ID:", id);
    Swal.fire({
      icon: "success",
      title: "Turno eliminado",
      text: "El turno ha sido eliminado correctamente.",
      timer: 1500,
      showConfirmButton: false
    });
  } catch (error) {
    console.error("Error al eliminar turno: ", error.code, error.message);
    Swal.fire({
      icon: "error",
      title: "Error",
      text: `No se pudo eliminar el turno: ${error.message || "Error desconocido"}`,
      confirmButtonColor: "#facc15"
    });
  }
}

// Actualizar turno
async function updateTurno(id, disponible, nombre = "", telefono = "") {
  if (!auth.currentUser || auth.currentUser.isAnonymous) {
    Swal.fire({
      icon: "error",
      title: "Error",
      text: "Debes iniciar sesión como administrador para realizar esta acción.",
      confirmButtonColor: "#facc15"
    });
    return;
  }

  if (!id) {
    console.error("ID de turno inválido en updateTurno:", id);
    Swal.fire({
      icon: "error",
      title: "Error",
      text: "ID de turno inválido. No se pudo actualizar.",
      confirmButtonColor: "#facc15"
    });
    return;
  }
  try {
    console.log("Actualizando turno con ID:", id, "Disponible:", disponible, "Nombre:", nombre, "Teléfono:", telefono);
    const turnoRef = db.collection("turnos").doc(id);
    const doc = await turnoRef.get();
    if (!doc.exists) {
      console.error("El turno no existe en Firestore, ID:", id);
      throw new Error("El turno no existe");
    }
    await turnoRef.update({
      Disponible: disponible,
      nombre: disponible === "Sí" ? "" : nombre,
      telefono: disponible === "Sí" ? "" : telefono
    });
    console.log("Turno actualizado con éxito, ID:", id);
    Swal.fire({
      icon: "success",
      title: "Turno actualizado",
      text: "El turno ha sido actualizado correctamente.",
      timer: 1500,
      showConfirmButton: false
    });
  } catch (error) {
    console.error("Error al actualizar turno: ", error.code, error.message);
    Swal.fire({
      icon: "error",
      title: "Error",
      text: `No se pudo actualizar el turno: ${error.message || "Error desconocido"}`,
      confirmButtonColor: "#facc15"
    });
  }
}

// Login con Firebase Authentication
async function login(email, password) {
  console.log("Intentando login con:", email);
  try {
    const userCredential = await auth.signInWithEmailAndPassword(email, password);
    console.log("Usuario logueado: ", userCredential.user.email);
    document.getElementById("admin-modal").classList.add("active");
    mostrarTurnosAdmin();
  } catch (error) {
    console.error("Error en login: ", error.code, error.message);
    let errorMessage;
    switch (error.code) {
      case "auth/invalid-login-credentials":
      case "auth/invalid-credential":
        errorMessage = "Correo o contraseña incorrectos.";
        break;
      case "auth/user-disabled":
        errorMessage = "Esta cuenta está deshabilitada. Contacta al administrador.";
        break;
      case "auth/too-many-requests":
        errorMessage = "Demasiados intentos fallidos. Intenta de nuevo más tarde.";
        break;
      case "auth/network-request-failed":
        errorMessage = "Error de red. Verifica tu conexión e intenta de nuevo.";
        break;
      default:
        errorMessage = "No se pudo iniciar sesión. Inténtalo de nuevo.";
    }
    Swal.fire({
      icon: "error",
      title: "Error de autenticación",
      text: errorMessage,
      confirmButtonColor: "#facc15"
    });
  }
}

// Logout con Firebase Authentication
async function logout() {
  try {
    await auth.signOut();
    console.log("Usuario desconectado");
    document.getElementById("admin-modal").classList.remove("active");
    Swal.fire({
      icon: "success",
      title: "Sesión cerrada",
      text: "Has cerrado sesión correctamente.",
      timer: 1500,
      showConfirmButton: false
    });
  } catch (error) {
    console.error("Error al cerrar sesión: ", error);
    Swal.fire({
      icon: "error",
      title: "Error",
      text: "No se pudo cerrar la sesión. Inténtalo de nuevo.",
      confirmButtonColor: "#facc15"
    });
  }
}

// Mostrar prompt de login para administrador
function mostrarPromptClave() {
  console.log("Mostrando prompt de login");
  document.getElementById("admin-modal").classList.remove("active");
  Swal.fire({
    title: "Acceso Administrativo",
    html: `
      <div class="text-left space-y-6 p-4">
        <div class="relative">
          <label for="adminEmail" class="block text-sm font-medium mb-2 text-gray-200 font-['Poppins'] flex items-center gap-2">
            <i class="fas fa-envelope text-yellow-400"></i> Correo Electrónico
          </label>
          <input 
            type="email" 
            id="adminEmail" 
            class="w-full p-3 pl-10 border border-gray-600 rounded-lg bg-gray-900 text-gray-200 focus:outline-none focus:ring-2 focus:ring-yellow-400 font-['Open Sans'] transition-all duration-300" 
            placeholder="admin@ejemplo.com" 
            aria-label="Correo electrónico del administrador"
          >
          <i class="fas fa-envelope absolute left-3 top-[2.8rem] text-gray-400"></i>
        </div>
        <div class="relative">
          <label for="adminPassword" class="block text-sm font-medium mb-2 text-gray-200 font-['Poppins'] flex items-center gap-2">
            <i class="fas fa-lock text-yellow-400"></i> Contraseña
          </label>
          <input 
            type="password" 
            id="adminPassword" 
            class="w-full p-3 pl-10 border border-gray-600 rounded-lg bg-gray-900 text-gray-200 focus:outline-none focus:ring-2 focus:ring-yellow-400 font-['Open Sans'] transition-all duration-300" 
            placeholder="••••••••" 
            aria-label="Contraseña del administrador"
          >
          <i class="fas fa-lock absolute left-3 top-[2.8rem] text-gray-400"></i>
        </div>
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: "Iniciar Sesión",
    cancelButtonText: "Cancelar",
    confirmButtonColor: "#facc15",
    cancelButtonColor: "#e3342f",
    width: "32rem",
    background: "#1f2937",
    color: "#e5e7eb",
    focusConfirm: false,
    customClass: {
      popup: "rounded-xl shadow-2xl",
      title: "text-2xl font-bold font-['Poppins'] text-gray-200",
      confirmButton: "px-6 py-3 rounded-lg font-['Poppins'] font-semibold text-gray-900 bg-yellow-400 hover:bg-yellow-500 transition-all duration-300 transform hover:scale-105",
      cancelButton: "px-6 py-3 rounded-lg font-['Poppins'] font-semibold text-white bg-red-600 hover:bg-red-700 transition-all duration-300 transform hover:scale-105"
    },
    didOpen: () => {
      setTimeout(() => {
        const emailInput = document.getElementById("adminEmail");
        if (emailInput) {
          emailInput.focus();
        }
      }, 100);
    },
    preConfirm: () => {
      const email = document.getElementById("adminEmail").value;
      const password = document.getElementById("adminPassword").value;
      if (!email || !password) {
        Swal.showValidationMessage("Por favor, ingresa correo y contraseña");
        return false;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        Swal.showValidationMessage("Por favor, ingresa un correo electrónico válido");
        return false;
      }
      return { email, password };
    }
  }).then((result) => {
    if (result.isConfirmed) {
      const { email, password } = result.value;
      login(email, password);
    } else {
      document.getElementById("admin-modal").classList.remove("active");
    }
  }).catch((error) => {
    console.error("Error en el prompt de login: ", error);
    Swal.fire({
      icon: "error",
      title: "Error",
      text: "No se pudo mostrar el formulario de login. Inténtalo de nuevo.",
      confirmButtonColor: "#facc15"
    });
  });
}

// Manejar toggle disponible
async function handleToggleDisponible(id, currentDisponible) {
  if (!auth.currentUser || auth.currentUser.isAnonymous) {
    Swal.fire({
      icon: "error",
      title: "Error",
      text: "Debes iniciar sesión como administrador para realizar esta acción.",
      confirmButtonColor: "#facc15"
    });
    return;
  }

  if (!id) {
    console.error("ID de turno inválido en handleToggleDisponible:", id);
    Swal.fire({
      icon: "error",
      title: "Error",
      text: "ID de turno inválido. No se pudo actualizar.",
      confirmButtonColor: "#facc15"
    });
    return;
  }
  const nuevoEstado = currentDisponible === "Sí" ? "No" : "Sí";
  if (nuevoEstado === "No") {
    Swal.fire({
      title: "Marcar como No Disponible",
      html: `
        <div class="text-left space-y-4">
          <div>
            <label class="block text-sm font-medium mb-1 text-gray-200 font-['Poppins']"><i class="fas fa-user mr-2 text-yellow-400"></i>Nombre:</label>
            <input type="text" id="toggleNombre" class="w-full p-3 border border-gray-600 rounded-lg bg-gray-900 text-gray-200 focus:outline-none focus:ring-2 focus:ring-yellow-400" placeholder="Nombre del cliente">
          </div>
          <div>
            <label class="block text-sm font-medium mb-1 text-gray-200 font-['Poppins']"><i class="fas fa-phone mr-2 text-yellow-400"></i>Teléfono:</label>
            <input type="tel" id="toggleTelefono" pattern="[0-9]{10,}" class="w-full p-3 border border-gray-600 rounded-lg bg-gray-900 text-gray-200 focus:outline-none focus:ring-2 focus:ring-yellow-400" placeholder="Ej: 3471234567">
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: "Guardar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#facc15",
      cancelButtonColor: "#e3342f",
      width: "32rem",
      background: "#1f2937",
      color: "#e5e7eb",
      preConfirm: () => {
        const nombre = document.getElementById("toggleNombre").value;
        const telefono = document.getElementById("toggleTelefono").value;
        if (!nombre || !telefono) {
          Swal.showValidationMessage("Por favor, ingresa nombre y teléfono");
          return false;
        }
        return { nombre, telefono };
      }
    }).then(async (result) => {
      if (result.isConfirmed) {
        const { nombre, telefono } = result.value;
        await updateTurno(id, nuevoEstado, nombre, telefono);
      }
    });
  } else {
    await updateTurno(id, nuevoEstado);
  }
}

// Manejar edición de nombre
async function handleEditName(id, currentName, currentDisponible) {
  if (!auth.currentUser || auth.currentUser.isAnonymous) {
    Swal.fire({
      icon: "error",
      title: "Error",
      text: "Debes iniciar sesión como administrador para realizar esta acción.",
      confirmButtonColor: "#facc15"
    });
    return;
  }

  Swal.fire({
    title: "Editar Nombre del Cliente",
    input: "text",
    inputLabel: "Nombre del Cliente",
    inputValue: currentName,
    inputPlaceholder: "Ingresa el nombre del cliente",
    showCancelButton: true,
    confirmButtonText: "Guardar",
    cancelButtonText: "Cancelar",
    confirmButtonColor: "#facc15",
    cancelButtonColor: "#e3342f",
    inputValidator: (value) => {
      if (!value) {
        return "Debes ingresar un nombre";
      }
    }
  }).then(async (result) => {
    if (result.isConfirmed) {
      await updateTurno(id, "No", result.value);
    }
  });
}

// Manejar edición de turno
async function handleEditTurno(id, currentFecha, currentHora, currentNombre, currentTelefono, currentDisponible) {
  if (!auth.currentUser || auth.currentUser.isAnonymous) {
    Swal.fire({
      icon: "error",
      title: "Error",
      text: "Debes iniciar sesión como administrador para realizar esta acción.",
      confirmButtonColor: "#facc15"
    });
    return;
  }

  Swal.fire({
    title: "Editar Turno",
    html: `
      <div class="text-left space-y-4">
        <div>
          <label class="block text-sm font-medium mb-1 text-gray-200 font-['Poppins']"><i class="fas fa-calendar-alt mr-2 text-yellow-400"></i>Fecha:</label>
          <input type="date" id="editFecha" value="${formatDateToISO(parseDMY(currentFecha))}" class="w-full p-3 border border-gray-600 rounded-lg bg-gray-900 text-gray-200 focus:outline-none focus:ring-2 focus:ring-yellow-400">
        </div>
        <div>
          <label class="block text-sm font-medium mb-1 text-gray-200 font-['Poppins']"><i class="fas fa-clock mr-2 text-yellow-400"></i>Hora:</label>
          <select id="editHora" class="w-full p-3 border border-gray-600 rounded-lg bg-gray-900 text-gray-200 focus:outline-none focus:ring-2 focus:ring-yellow-400">
            ${horarios.map(h => `<option value="${h}" ${h === currentHora ? "selected" : ""}>${h}</option>`).join("")}
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium mb-1 text-gray-200 font-['Poppins']"><i class="fas fa-user mr-2 text-yellow-400"></i>Nombre:</label>
          <input type="text" id="editNombre" value="${currentNombre}" class="w-full p-3 border border-gray-600 rounded-lg bg-gray-900 text-gray-200 focus:outline-none focus:ring-2 focus:ring-yellow-400" placeholder="Nombre del cliente">
        </div>
        <div>
          <label class="block text-sm font-medium mb-1 text-gray-200 font-['Poppins']"><i class="fas fa-phone mr-2 text-yellow-400"></i>Teléfono:</label>
          <input type="tel" id="editTelefono" value="${currentTelefono}" pattern="[0-9]{10,}" class="w-full p-3 border border-gray-600 rounded-lg bg-gray-900 text-gray-200 focus:outline-none focus:ring-2 focus:ring-yellow-400" placeholder="Ej: 3471234567">
        </div>
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: "Guardar",
    cancelButtonText: "Cancelar",
    confirmButtonColor: "#facc15",
    cancelButtonColor: "#e3342f",
    width: "32rem",
    background: "#1f2937",
    color: "#e5e7eb",
    preConfirm: async () => {
      const fecha = document.getElementById("editFecha").value;
      const hora = document.getElementById("editHora").value;
      const nombre = document.getElementById("editNombre").value;
      const telefono = document.getElementById("editTelefono").value;

      if (!fecha || !hora || !nombre || !telefono) {
        Swal.showValidationMessage("Todos los campos son obligatorios");
        return false;
      }

      const selectedDate = parseDMY(fecha);
      if (!selectedDate || isNaN(selectedDate)) {
        Swal.showValidationMessage("La fecha ingresada no es válida");
        return false;
      }

      if (!diasHabilitados.includes(selectedDate.getDay())) {
        Swal.showValidationMessage("La fecha debe ser un día laborable (martes a sábado)");
        return false;
      }

      const formattedFecha = formatDate(fecha);
      const turnos = await obtenerTurnos();
      const turnoExists = turnos.some(t => t.fecha === formattedFecha && t.hora === hora && t.id !== id);
      if (turnoExists) {
        Swal.showValidationMessage("Ya existe un turno en esa fecha y hora.");
        return false;
      }

      return { fecha: formattedFecha, hora, nombre, telefono, originalFecha: currentFecha, originalHora: currentHora };
    }
  }).then(async (result) => {
    if (result.isConfirmed) {
      const { fecha, hora, nombre, telefono, originalFecha, originalHora } = result.value;
      try {
        await db.runTransaction(async (transaction) => {
          const turnoRef = db.collection("turnos").doc(id);
          const turnoDoc = await turnoRef.get();
          if (!turnoDoc.exists) {
            throw new Error("El turno no existe");
          }

          if (fecha !== originalFecha || hora !== originalHora) {
            const originalTurnoExists = (await db.collection("turnos")
              .where("fecha", "==", originalFecha)
              .where("hora", "==", originalHora)
              .get()).empty;
            if (originalTurnoExists) {
              const newTurnoRef = db.collection("turnos").doc();
              transaction.set(newTurnoRef, {
                fecha: originalFecha,
                hora: originalHora,
                Disponible: "Sí",
                nombre: "",
                telefono: ""
              });
              console.log("Creado nuevo turno disponible en fecha original:", originalFecha, originalHora);
            }
          }

          transaction.update(turnoRef, {
            fecha: fecha,
            hora: hora,
            Disponible: "No",
            nombre: nombre,
            telefono: telefono
          });
          console.log("Turno actualizado con ID:", id, "Nueva fecha:", fecha, "Nueva hora:", hora);
        });

        Swal.fire({
          icon: "success",
          title: "Turno actualizado",
          text: "El turno ha sido actualizado correctamente.",
          timer: 1500,
          showConfirmButton: false
        });
      } catch (error) {
        console.error("Error al actualizar turno: ", error.code, error.message);
        Swal.fire({
          icon: "error",
          title: "Error",
          text: `No se pudo actualizar el turno: ${error.message || "Error desconocido"}`,
          confirmButtonColor: "#facc15"
        });
      }
    }
  });
}

// Manejar eliminación de turno
async function handleDeleteTurno(id) {
  if (!auth.currentUser || auth.currentUser.isAnonymous) {
    Swal.fire({
      icon: "error",
      title: "Error",
      text: "Debes iniciar sesión como administrador para realizar esta acción.",
      confirmButtonColor: "#facc15"
    });
    return;
  }

  if (!id) {
    console.error("ID de turno inválido en handleDeleteTurno:", id);
    Swal.fire({
      icon: "error",
      title: "Error",
      text: "ID de turno inválido. No se pudo eliminar.",
      confirmButtonColor: "#facc15"
    });
    return;
  }
  Swal.fire({
    title: "¿Estás seguro?",
    text: "Esta acción eliminará el turno permanentemente.",
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Eliminar",
    cancelButtonText: "Cancelar",
    confirmButtonColor: "#dc2626",
    cancelButtonColor: "#e3342f"
  }).then(async (result) => {
    if (result.isConfirmed) {
      await deleteTurno(id);
    }
  });
}

// Exportar turnos a JSON
async function exportTurnos() {
  try {
    const turnos = await obtenerTurnos();
    const dataStr = JSON.stringify(turnos, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `turnos_mbs_${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    Swal.fire({
      icon: "success",
      title: "Turnos exportados",
      text: "Los turnos se han exportado correctamente como archivo JSON.",
      timer: 1500,
      showConfirmButton: false
    });
  } catch (error) {
    console.error("Error al exportar turnos: ", error);
    Swal.fire({
      icon: "error",
      title: "Error",
      text: "No se pudieron exportar los turnos. Inténtalo de nuevo.",
      confirmButtonColor: "#facc15"
    });
  }
}

// Importar turnos desde JSON
async function importTurnos() {
  Swal.fire({
    title: "Importar Turnos",
    text: "Selecciona un archivo JSON con los turnos.",
    input: "file",
    inputAttributes: {
      accept: ".json",
      "aria-label": "Subir archivo JSON"
    },
    showCancelButton: true,
    confirmButtonText: "Importar",
    cancelButtonText: "Cancelar",
    confirmButtonColor: "#facc15",
    cancelButtonColor: "#e3342f"
  }).then(async (result) => {
    if (result.isConfirmed && result.value) {
      const file = result.value;
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const importedTurnos = JSON.parse(e.target.result);
          if (!Array.isArray(importedTurnos)) {
            throw new Error("El archivo no contiene una lista válida de turnos.");
          }
          const isValid = importedTurnos.every(t => 
            t.fecha && t.hora && t.Disponible && 
            (t.Disponible === "Sí" || (t.nombre && t.telefono))
          );
          if (!isValid) {
            throw new Error("El formato de los turnos no es válido.");
          }
          const existingTurnos = await obtenerTurnos();
          for (const turno of importedTurnos) {
            const turnoExists = existingTurnos.some(t => t.fecha === turno.fecha && t.hora === turno.hora);
            if (!turnoExists) {
              await db.collection("turnos").add(turno);
            }
          }
          Swal.fire({
            icon: "success",
            title: "Turnos importados",
            text: "Los turnos se han importados correctamente.",
            timer: 1500,
            showConfirmButton: false
          });
        } catch (err) {
          console.error("Error al importar turnos: ", err);
          Swal.fire({
            icon: "error",
            title: "Error",
            text: `No se pudieron importar los turnos: ${err.message}`,
            confirmButtonColor: "#facc15"
          });
        }
      };
      reader.readAsText(file);
    }
  });
}

// Mostrar turnos en el panel de administración
function mostrarTurnosAdmin(selectedDate = "") {
  escucharTurnos((turnos) => {
    const lista = document.getElementById("listaTurnosAdmin");
    const listaMobile = document.getElementById("turnos-mobile");
    
    lista.innerHTML = "";
    listaMobile.innerHTML = "";

    const isMobile = window.innerWidth <= 640;

    if (turnos.length === 0) {
      const message = selectedDate
        ? `No se encontraron turnos para ${formatDate(selectedDate)}.`
        : "No se encontraron turnos. Genera turnos para comenzar.";
      if (!isMobile) {
        lista.innerHTML = `<tr><td colspan="5" class="text-center">${message}</td></tr>`;
      } else {
        listaMobile.innerHTML = `<p class="text-center text-gray-200">${message}</p>`;
      }
      return;
    }

    turnos.sort((a, b) => {
      const dateA = parseDMY(a.fecha);
      const dateB = parseDMY(b.fecha);
      return dateA - dateB || a.hora.localeCompare(b.hora);
    });

    turnos.forEach((t) => {
      const id = t.id || "";
      const fecha = t.fecha ? formatDate(t.fecha) : "Fecha no disponible";
      const hora = t.hora || "Hora no disponible";
      const disponible = t.Disponible || "Desconocido";
      const nombre = t.nombre || "";
      const telefono = t.telefono || "";
      const estado = disponible === "Sí" ? '<span style="color: #10b981;">Disponible</span>' : nombre ? '<span style="color: #facc15;">Reservado</span>' : '<span style="color: #e3342f;">No Disponible</span>';

      if (!isMobile) {
        const row = document.createElement("tr");
        row.innerHTML = `
          <td>${fecha}</td>
          <td>${hora}</td>
          <td>${estado}</td>
          <td class="editable-name" onclick="handleEditName('${id}', '${nombre}', '${disponible}')">${nombre || "—"}</td>
          <td>
            <button class="toggle-disponible ${disponible === 'Sí' ? 'disponible' : 'no-disponible'}" onclick="handleToggleDisponible('${id}', '${disponible}')">
              ${disponible === "Sí" ? "Marcar No Disponible" : "Marcar Disponible"}
            </button>
            <button class="edit-turno" onclick="handleEditTurno('${id}', '${fecha}', '${hora}', '${nombre}', '${telefono}', '${disponible}')">
              Editar
            </button>
            <button class="delete-turno" onclick="handleDeleteTurno('${id}')">
              Eliminar
            </button>
          </td>
        `;
        lista.appendChild(row);
      } else {
        const card = document.createElement("div");
        card.className = "turno-card";
        card.innerHTML = `
          <p><strong>Fecha:</strong> ${fecha}</p>
          <p><strong>Hora:</strong> ${hora}</p>
          <p><strong>Estado:</strong> ${estado}</p>
          <p><strong>Cliente:</strong> <span class="editable-name" onclick="handleEditName('${id}', '${nombre}', '${disponible}')">${nombre || "—"}</span></p>
          <p><strong>Teléfono:</strong> ${telefono || "—"}</p>
          <div class="turno-actions">
            <button class="toggle-disponible ${disponible === 'Sí' ? 'disponible' : 'no-disponible'}" onclick="handleToggleDisponible('${id}', '${disponible}')">
              ${disponible === "Sí" ? "No Disponible" : "Disponible"}
            </button>
            <button class="edit-turno" onclick="handleEditTurno('${id}', '${fecha}', '${hora}', '${nombre}', '${telefono}', '${disponible}')">
              Editar
            </button>
            <button class="delete-turno" onclick="handleDeleteTurno('${id}')">
              Eliminar
            </button>
          </div>
        `;
        listaMobile.appendChild(card);
      }
    });
  }, selectedDate);
}

// Actualizar horarios disponibles para clientes
async function updateTimeSlots() {
  const fechaInput = document.getElementById("fecha");
  const horaSelect = document.getElementById("hora");
  const selectedDate = fechaInput.value;
  horaSelect.innerHTML = '<option value="" disabled selected>Selecciona una hora</option>';

  if (!selectedDate) {
    horaSelect.disabled = true;
    return;
  }

  const parsedDate = parseDMY(selectedDate);
  if (!parsedDate || isNaN(parsedDate)) {
    Swal.fire({
      icon: "warning",
      title: "Fecha inválida",
      text: "Por favor, selecciona una fecha válida.",
      confirmButtonColor: "#facc15"
    });
    fechaInput.value = "";
    horaSelect.disabled = true;
    return;
  }

  if (!diasHabilitados.includes(parsedDate.getDay())) {
    Swal.fire({
      icon: "warning",
      title: "Día no laborable",
      text: "Solo se pueden reservar turnos de martes a sábado.",
      confirmButtonColor: "#facc15"
    });
    fechaInput.value = "";
    horaSelect.disabled = true;
    return;
  }

  const formattedSelectedDate = formatDate(selectedDate);
  try {
    console.log("Consultando turnos disponibles para:", formattedSelectedDate);
    const querySnapshot = await db.collection("turnos")
      .where("fecha", "==", formattedSelectedDate)
      .where("Disponible", "==", "Sí")
      .get();
    const disponibles = [];
    querySnapshot.forEach((doc) => {
      disponibles.push(doc.data());
    });

    console.log("Turnos disponibles encontrados:", disponibles);
    disponibles.sort((a, b) => a.hora.localeCompare(b.hora));

    disponibles.forEach((t) => {
      const option = document.createElement("option");
      option.value = t.hora || "";
      option.textContent = t.hora ? `${t.hora} (Disponible)` : "Hora no disponible";
      horaSelect.appendChild(option);
    });

    horaSelect.disabled = false;
    if (disponibles.length === 0) {
      horaSelect.innerHTML = '<option value="" disabled selected>No hay horarios disponibles para esta fecha. Intenta con otra.</option>';
      horaSelect.disabled = true;
    }
  } catch (error) {
    console.error("Error al cargar horarios disponibles: ", error.code, error.message);
    Swal.fire({
      icon: "error",
      title: "Error",
      text: "No se pudieron cargar los horarios. Inténtalo de nuevo.",
      confirmButtonColor: "#facc15"
    });
  }
}

// Manejar reserva de turno con transacción
async function reservarTurno(event) {
  event.preventDefault();
  console.log("Iniciando reservarTurno...");

  // Verificar autenticación
  if (!auth.currentUser) {
    console.error("Usuario no autenticado. Intentando autenticación anónima...");
    try {
      await auth.signInAnonymously();
      console.log("Autenticación anónima exitosa:", auth.currentUser.uid);
    } catch (error) {
      console.error("Error en autenticación anónima:", error.code, error.message);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "No se pudo autenticar al usuario. Inténtalo de nuevo.",
        confirmButtonColor: "#facc15"
      });
      return;
    }
  }

  console.log("Usuario autenticado:", auth.currentUser.uid, "Es anónimo:", auth.currentUser.isAnonymous);

  const nombre = document.getElementById("nombre").value;
  const telefono = document.getElementById("telefono").value;
  const fecha = document.getElementById("fecha").value;
  const hora = document.getElementById("hora").value;

  if (!fecha || !hora || !nombre || !telefono) {
    console.error("Faltan datos en el formulario:", { fecha, hora, nombre, telefono });
    Swal.fire({
      icon: "warning",
      title: "Faltan datos",
      text: "Por favor, completa todos los campos.",
      confirmButtonColor: "#facc15"
    });
    return;
  }

  const parsedDate = parseDMY(fecha);
  if (!parsedDate || isNaN(parsedDate)) {
    console.error("Fecha inválida:", fecha);
    Swal.fire({
      icon: "warning",
      title: "Fecha inválida",
      text: "Por favor, selecciona una fecha válida.",
      confirmButtonColor: "#facc15"
    });
    return;
  }

  const formattedDate = formatDate(fecha);
  console.log("Intentando reservar turno:", { nombre, telefono, fecha: formattedDate, hora });

  try {
    await db.runTransaction(async (transaction) => {
      console.log("Iniciando transacción para fecha:", formattedDate, "hora:", hora);
      const querySnapshot = await db.collection("turnos")
        .where("fecha", "==", formattedDate)
        .where("hora", "==", hora)
        .where("Disponible", "==", "Sí")
        .get();

      if (querySnapshot.empty) {
        console.error("No se encontró turno disponible para:", formattedDate, hora);
        throw new Error("El turno ya no está disponible o no existe.");
      }

      const turnoDoc = querySnapshot.docs[0];
      const turnoId = turnoDoc.id;
      const turnoData = turnoDoc.data();
      console.log("Turno encontrado, ID:", turnoId, "Datos:", turnoData);

      const turnoRef = db.collection("turnos").doc(turnoId);
      const turnoSnap = await transaction.get(turnoRef);
      if (!turnoSnap.exists) {
        console.error("El turno no existe en la transacción, ID:", turnoId);
        throw new Error("El turno no existe.");
      }
      if (turnoSnap.data().Disponible !== "Sí") {
        console.error("El turno ya no está disponible, ID:", turnoId, "Estado:", turnoSnap.data().Disponible);
        throw new Error("El turno ya fue reservado.");
      }

      console.log("Actualizando turno con ID:", turnoId);
      transaction.update(turnoRef, {
        nombre: nombre,
        telefono: telefono,
        Disponible: "No",
        fechaReserva: firebase.firestore.FieldValue.serverTimestamp()
      });
      console.log("Transacción completada para turno ID:", turnoId);
    });

    Swal.fire({
      icon: "success",
      title: "¡Reserva Confirmada!",
      html: `
        <p>Tu turno ha sido reservado con éxito.</p>
        <p><strong>Nombre:</strong> ${nombre}</p>
        <p><strong>Fecha:</strong> ${formattedDate}</p>
        <p><strong>Hora:</strong> ${hora}</p>
        <p>Por favor, confirma tu turno enviando el mensaje por WhatsApp.</p>
      `,
      confirmButtonText: "Enviar Confirmación por WhatsApp",
      confirmButtonColor: "#facc15",
      showCancelButton: true,
      cancelButtonText: "Cerrar",
      cancelButtonColor: "#e3342f"
    }).then((result) => {
      if (result.isConfirmed) {
        enviarMensajeWhatsapp(nombre, formattedDate, hora);
      }
    });

    document.getElementById("reserva-form").reset();
    document.getElementById("fecha").value = "";
    document.getElementById("hora").innerHTML = '<option value="" disabled selected>Selecciona una hora</option>';
    document.getElementById("hora").disabled = true;
    await updateTimeSlots();
  } catch (error) {
    console.error("Error al reservar turno: ", error.code, error.message);
    Swal.fire({
      icon: "error",
      title: "Error",
      text: error.message || "No se pudo reservar el turno. Inténtalo de nuevo.",
      confirmButtonColor: "#facc15"
    });
    await updateTimeSlots();
  }
}

// Enviar mensaje de WhatsApp
function enviarMensajeWhatsapp(nombre, fecha, hora) {
  const telefono = "5493471234567";
  const mensaje = `Hola, soy ${nombre}. Confirmo mi turno reservado para el ${fecha} a las ${hora}. Por favor, confirmar recepción.`;
  const url = `https://wa.me/${telefono}?text=${encodeURIComponent(mensaje)}`;
  console.log("Abriendo WhatsApp con mensaje:", mensaje);
  window.open(url, "_blank");
}

// Inicializar eventos y restricciones de fecha
document.addEventListener("DOMContentLoaded", async () => {
  console.log("DOM completamente cargado");

  // Esperar a que la autenticación anónima se complete
  try {
    await new Promise((resolve, reject) => {
      const unsubscribe = auth.onAuthStateChanged((user) => {
        if (user) {
          console.log("Usuario autenticado al cargar:", user.uid, "Es anónimo:", user.isAnonymous);
          unsubscribe();
          resolve();
        } else {
          console.log("No hay usuario autenticado, intentando autenticación anónima...");
          auth.signInAnonymously().then(() => {
            console.log("Autenticación anónima exitosa");
            unsubscribe();
            resolve();
          }).catch((error) => {
            console.error("Error en autenticación anónima:", error.code, error.message);
            unsubscribe();
            reject(error);
          });
        }
      });
    });
  } catch (error) {
    console.error("Error al inicializar autenticación:", error);
    Swal.fire({
      icon: "error",
      title: "Error",
      text: "No se pudo autenticar al usuario. Inténtalo de nuevo.",
      confirmButtonColor: "#facc15"
    });
  }

  // Vincular eventos de admin
  const adminLink = document.getElementById("admin-link");
  const adminLinkMobile = document.getElementById("admin-link-mobile");
  
  if (adminLink) {
    adminLink.addEventListener("click", (e) => {
      e.preventDefault();
      console.log("Botón Admin clicado (escritorio)");
      if (auth.currentUser && !auth.currentUser.isAnonymous) {
        document.getElementById("admin-modal").classList.add("active");
        mostrarTurnosAdmin();
      } else {
        mostrarPromptClave();
      }
    });
  } else {
    console.error("Elemento con ID 'admin-link' no encontrado");
  }

  if (adminLinkMobile) {
    adminLinkMobile.addEventListener("click", (e) => {
      e.preventDefault();
      console.log("Botón Admin móvil clicado");
      if (auth.currentUser && !auth.currentUser.isAnonymous) {
        document.getElementById("admin-modal").classList.add("active");
        mostrarTurnosAdmin();
      } else {
        mostrarPromptClave();
      }
    });
  } else {
    console.error("Elemento con ID 'admin-link-mobile' no encontrado");
  }

  const fechaInput = document.getElementById("fecha");
  const horaSelect = document.getElementById("hora");
  const today = new Date();
  const minDate = new Date(today);
  if (fechaInput) {
    fechaInput.min = formatDateToISO(minDate);

    fechaInput.addEventListener("change", async (e) => {
      const selectedDate = parseDMY(e.target.value);
      if (!selectedDate || isNaN(selectedDate)) {
        Swal.fire({
          icon: "warning",
          title: "Fecha inválida",
          text: "Por favor, selecciona una fecha válida.",
          confirmButtonColor: "#facc15"
        });
        e.target.value = "";
        horaSelect.disabled = true;
        horaSelect.innerHTML = '<option value="" disabled selected>Selecciona una hora</option>';
        return;
      }

      const dayOfWeek = selectedDate.getDay();
      if (!diasHabilitados.includes(dayOfWeek)) {
        Swal.fire({
          icon: "warning",
          title: "Día no laborable",
          text: "Solo se pueden reservar turnos de martes a sábado.",
          confirmButtonColor: "#facc15"
        });
        e.target.value = "";
        horaSelect.disabled = true;
        horaSelect.innerHTML = '<option value="" disabled selected>Selecciona una hora</option>';
        return;
      }

      await updateTimeSlots();
    });
  }

  if (horaSelect) {
    horaSelect.disabled = true;
  }

  const generarTurnosBtn = document.getElementById("generarTurnos");
  const exportTurnosBtn = document.getElementById("exportTurnos");
  const logoutBtn = document.getElementById("logout");
  const closeModalBtn = document.querySelector("#admin-modal .close-modal");
  const fechaGenerarInput = document.getElementById("fechaGenerar");
  const fechaFiltroInput = document.getElementById("fechaFiltro");

  if (generarTurnosBtn) generarTurnosBtn.addEventListener("click", generarTurnos);
  if (exportTurnosBtn) exportTurnosBtn.addEventListener("click", exportTurnos);
  if (logoutBtn) logoutBtn.addEventListener("click", logout);
  if (closeModalBtn) {
    closeModalBtn.addEventListener("click", () => {
      document.getElementById("admin-modal").classList.remove("active");
    });
  }
  if (fechaFiltroInput) {
    fechaFiltroInput.addEventListener("change", (e) => {
      const selectedDate = e.target.value;
      mostrarTurnosAdmin(selectedDate);
    });
  }

  const reservaForm = document.getElementById("reserva-form");
  if (reservaForm) {
    reservaForm.addEventListener("submit", reservarTurno);
  }

  const menuToggle = document.querySelector(".menu-toggle");
  const mobileMenu = document.getElementById("mobile-menu");
  if (menuToggle && mobileMenu) {
    menuToggle.addEventListener("click", () => {
      mobileMenu.classList.toggle("hidden");
      mobileMenu.classList.toggle("active");
      menuToggle.innerHTML = mobileMenu.classList.contains("hidden") ? '<i class="fas fa-bars text-2xl"></i>' : '<i class="fas fa-times text-2xl"></i>';
    });
  }

  document.querySelectorAll("#mobile-menu a").forEach((link) => {
    link.addEventListener("click", () => {
      mobileMenu.classList.add("hidden");
      mobileMenu.classList.remove("active");
      menuToggle.innerHTML = '<i class="fas fa-bars text-2xl"></i>';
    });
  });

  window.addEventListener("resize", () => {
    const fechaFiltroInput = document.getElementById("fechaFiltro");
    const selectedDate = fechaFiltroInput ? fechaFiltroInput.value : "";
    mostrarTurnosAdmin(selectedDate);
  });
});
