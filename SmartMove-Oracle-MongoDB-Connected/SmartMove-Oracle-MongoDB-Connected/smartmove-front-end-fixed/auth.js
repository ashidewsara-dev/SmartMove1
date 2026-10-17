
/* Demo-only front-end account flow.
   No server or real authentication. */

(function () {
  const ADMIN = {
    email: 'admin@smartmove.demo',
    password: 'Admin123!',
    name: 'SmartMove Admin',
    role: 'admin'
  };

  const DEMO_CUSTOMER = {
    email: 'customer@smartmove.demo',
    password: 'Passenger123!',
    name: 'Demo Passenger',
    role: 'customer'
  };

  const getUsers = () => {
    try {
      return JSON.parse(
        localStorage.getItem('smartmoveDemoUsers') || '[]'
      );
    } catch {
      return [];
    }
  };

  const setError = (msg) => {
    const el = document.getElementById('authError');

    if (el) {
      el.textContent = msg;
      el.style.display = 'block';
    }
  };

  const clearError = () => {
    const el = document.getElementById('authError');

    if (el) {
      el.textContent = '';
      el.style.display = 'none';
    }
  };

  const go = (user) => {
    sessionStorage.setItem('smartmoveRole', user.role);
    sessionStorage.setItem('smartmoveName', user.name);

    if (user.role === 'customer') {
      sessionStorage.setItem(
        'smartmoveEmail',
        user.email.trim().toLowerCase()
      );
    } else {
      sessionStorage.removeItem('smartmoveEmail');
    }

    location.href =
      user.role === 'admin' ? 'admin.html' : 'customer.html';
  };

  document.addEventListener('DOMContentLoaded', () => {
    const pageRole = document.body.dataset.role;

    // Protect the admin and customer portal pages from
    // accidental access without the matching demo session.
    if (pageRole) {
      const activeRole = sessionStorage.getItem('smartmoveRole');

      if (activeRole !== pageRole) {
        location.replace('login.html');
        return;
      }

      const name =
        sessionStorage.getItem('smartmoveName') ||
        (pageRole === 'admin'
          ? 'SmartMove Admin'
          : 'Demo Passenger');

      const initials = name
        .split(/\s+/)
        .map((part) => part[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();

      const profileName = document.getElementById('profileName');

      if (profileName) {
        profileName.textContent = name;
      }

      ['profileInitials', 'topAvatar'].forEach((id) => {
        const el = document.getElementById(id);

        if (el) {
          el.textContent = initials;
        }
      });

      const logout = document.getElementById('logoutButton');

      if (logout) {
        logout.addEventListener('click', (event) => {
          event.preventDefault();

          sessionStorage.removeItem('smartmoveRole');
          sessionStorage.removeItem('smartmoveName');
          sessionStorage.removeItem('smartmoveEmail');

          location.href = 'login.html';
        });
      }

      return;
    }

    // LOGIN
    const login = document.getElementById('loginForm');

    if (login) {
      login.addEventListener('submit', (event) => {
        event.preventDefault();
        clearError();

        const data = Object.fromEntries(new FormData(login));
        const email = (data.email || '').trim().toLowerCase();
        const password = data.password || '';
        const role = data.role;

        let user = null;

        if (
          role === 'admin' &&
          email === ADMIN.email &&
          password === ADMIN.password
        ) {
          user = ADMIN;
        } else if (
          role === 'customer' &&
          email === DEMO_CUSTOMER.email &&
          password === DEMO_CUSTOMER.password
        ) {
          user = DEMO_CUSTOMER;
        } else if (role === 'customer') {
          user = getUsers().find(
            (savedUser) =>
              savedUser.email &&
              savedUser.email.toLowerCase() === email &&
              savedUser.password === password &&
              savedUser.role === 'customer'
          ) || null;
        }

        if (!user) {
          setError(
            'Email, password, or account type is incorrect. ' +
            'Use the demo credentials or register as a passenger.'
          );
          return;
        }

        go(user);
      });
    }

    // REGISTRATION
    const register = document.getElementById('registerForm');

    if (register) {
      register.addEventListener('submit', (event) => {
        event.preventDefault();
        clearError();

        const data = Object.fromEntries(new FormData(register));

        const fullName = (data.fullName || '').trim();
        const email = (data.email || '').trim().toLowerCase();
        const password = data.password || '';
        const confirmPassword = data.confirmPassword || '';

        if (!fullName || !email || !password) {
          setError('Please complete all required fields.');
          return;
        }

        if (password !== confirmPassword) {
          setError('The passwords do not match.');
          return;
        }

        const users = getUsers();

        if (
          email === ADMIN.email ||
          email === DEMO_CUSTOMER.email ||
          users.some(
            (savedUser) =>
              savedUser.email &&
              savedUser.email.toLowerCase() === email
          )
        ) {
          setError(
            'An account with this email already exists. Please sign in.'
          );
          return;
        }

        const newUser = {
          name: fullName,
          email: email,
          password: password,
          role: 'customer'
        };

        users.push(newUser);

        try {
          localStorage.setItem(
            'smartmoveDemoUsers',
            JSON.stringify(users)
          );
        } catch (error) {
          setError(
            'Could not save your account in this browser. ' +
            'Please check your browser storage settings.'
          );
          return;
        }

        // Automatically sign in after successful registration.
        go(newUser);
      });
    }
  });
})();
