/**
 * RESUMAI - Button Login Flow & Global Authentication Interceptor
 */
(function() {
    function isLoggedIn() {
        if (window.app && typeof window.app.isLoggedIn === 'function') {
            return window.app.isLoggedIn();
        }
        try {
            const session = localStorage.getItem('resumai_auth_session');
            const user = localStorage.getItem('resumai_auth_user');
            return !!user && session === 'active';
        } catch (e) {
            return false;
        }
    }

    function fillDemoCredentials() {
        const emailInput = document.getElementById('signin-email');
        const passInput = document.getElementById('signin-password');
        if (emailInput && !emailInput.value) emailInput.value = 'demo@resumai.com';
        if (passInput && !passInput.value) passInput.value = 'Demo@123';
    }

    function redirectToSignIn(targetPage) {
        if (targetPage && targetPage !== 'sign-in' && targetPage !== 'sign-up') {
            window.pendingTargetPage = targetPage;
            if (window.app) window.app.pendingTargetPage = targetPage;
        }
        fillDemoCredentials();
        if (window.app && typeof window.app.showToast === 'function') {
            window.app.showToast('Please sign in to continue!', 'info');
        }
        if (window.app && typeof window.app.navigateTo === 'function') {
            window.app.navigateTo('sign-in');
        } else {
            document.querySelectorAll('.page-view').forEach(p => p.classList.remove('active'));
            const signInPage = document.getElementById('page-sign-in');
            if (signInPage) signInPage.classList.add('active');
        }
    }

    document.addEventListener('click', function(e) {
        const btn = e.target.closest('button, .btn, a.btn, [data-page], .fab-menu-item, .fab-toggle-btn');
        if (!btn) return;

        if (btn.closest('#page-sign-in, #page-sign-up, #modal-forgot-password, .auth-card') ||
            btn.id === 'btn-sign-in' || btn.id === 'btn-sign-up' || btn.id === 'btn-sign-out' ||
            btn.id === 'mobile-nav-toggle' || btn.classList.contains('password-toggle') ||
            btn.classList.contains('theme-toggle') || btn.classList.contains('modal-close')) {
            return;
        }

        if (!isLoggedIn()) {
            e.preventDefault();
            e.stopPropagation();
            const targetPage = btn.getAttribute('data-page');
            redirectToSignIn(targetPage);
        }
    }, true);

    function patchAppLogin() {
        if (!window.app) return;

        window.app.isLoggedIn = function() {
            return !!this.authUser && localStorage.getItem('resumai_auth_session') === 'active';
        };

        const originalSignIn = window.app.signIn ? window.app.signIn.bind(window.app) : null;
        if (originalSignIn) {
            window.app.signIn = function() {
                fillDemoCredentials();
                originalSignIn();
                if (this.isLoggedIn()) {
                    const target = this.pendingTargetPage || window.pendingTargetPage || 'dashboard';
                    this.pendingTargetPage = null;
                    window.pendingTargetPage = null;
                    this.navigateTo(target);
                }
            };
        }

        const originalSignUp = window.app.signUp ? window.app.signUp.bind(window.app) : null;
        if (originalSignUp) {
            window.app.signUp = function() {
                originalSignUp();
                if (this.isLoggedIn()) {
                    const target = this.pendingTargetPage || window.pendingTargetPage || 'dashboard';
                    this.pendingTargetPage = null;
                    window.pendingTargetPage = null;
                    this.navigateTo(target);
                }
            };
        }

        const originalSocialAuth = window.app.handleSocialAuth ? window.app.handleSocialAuth.bind(window.app) : null;
        if (originalSocialAuth) {
            window.app.handleSocialAuth = function(provider) {
                originalSocialAuth(provider);
                setTimeout(() => {
                    if (this.isLoggedIn()) {
                        const target = this.pendingTargetPage || window.pendingTargetPage || 'dashboard';
                        this.pendingTargetPage = null;
                        window.pendingTargetPage = null;
                        this.navigateTo(target);
                    }
                }, 600);
            };
        }

        window.app.setResumeStyle = function(styleName, btnEl) {
            this.resumeStyle = styleName;
            localStorage.setItem('resumai_resume_style', styleName);
            localStorage.setItem('pap_selected_template', styleName);

            document.querySelectorAll('.tmpl-pill').forEach(b => b.classList.remove('active'));
            if (btnEl) {
                btnEl.classList.add('active');
            } else {
                document.querySelectorAll('.tmpl-pill').forEach(b => {
                    if (b.textContent.trim().toLowerCase().includes(styleName.toLowerCase())) {
                        b.classList.add('active');
                    }
                });
            }

            const styles = ['modern', 'professional', 'creative', 'minimal', 'executive', 'technical', 'elegant', 'corporate'];
            styles.forEach(s => document.body.classList.remove(`template-${s}`));
            document.body.classList.add(`template-${styleName.toLowerCase()}`);

            if (typeof this.showToast === 'function') {
                this.showToast(`${styleName} template selected!`, 'success');
            }
        };

        const originalUpdateAuthUI = window.app.updateAuthUI ? window.app.updateAuthUI.bind(window.app) : null;
        window.app.updateAuthUI = function() {
            if (originalUpdateAuthUI) originalUpdateAuthUI();
            const signedIn = this.isLoggedIn();
            document.body.classList.toggle('user-logged-in', signedIn);

            let storedUser = null;
            try {
                storedUser = JSON.parse(localStorage.getItem('resumai_auth_user'));
            } catch(e) {}

            const userObj = storedUser || this.authUser || this.profile || {};
            const fullName = userObj.name || (userObj.email ? userObj.email.split('@')[0] : 'User Profile');
            
            const nameEl = document.getElementById('sidebar-user-name');
            const pillEl = document.getElementById('headerUserPill');
            const avatarEl = document.getElementById('sidebar-avatar');

            if (nameEl) {
                nameEl.textContent = fullName;
                nameEl.setAttribute('title', fullName);
            }
            if (pillEl) {
                pillEl.setAttribute('title', `User: ${fullName}`);
            }
            if (avatarEl && fullName) {
                avatarEl.textContent = fullName.charAt(0).toUpperCase();
            }
        };
        window.app.updateAuthUI();

        const originalNavigateTo = window.app.navigateTo ? window.app.navigateTo.bind(window.app) : null;
        if (originalNavigateTo) {
            window.app.navigateTo = function(pageId) {
                const publicPages = ['home', 'sign-in', 'sign-up'];
                if (!this.isLoggedIn() && !publicPages.includes(pageId)) {
                    this.pendingTargetPage = pageId;
                    window.pendingTargetPage = pageId;
                    fillDemoCredentials();
                    if (typeof this.showToast === 'function') {
                        this.showToast('Please sign in to access this page!', 'info');
                    }
                    pageId = 'sign-in';
                }
                return originalNavigateTo(pageId);
            };
        }
    }

    window.papSelectAndUseTemplate = function(name) {
        window.papSelectedTemplate = name;
        localStorage.setItem('pap_selected_template', name);
        if (window.app && typeof window.app.setResumeStyle === 'function') {
            window.app.setResumeStyle(name);
        }
        if (window.app && typeof window.app.navigateTo === 'function') {
            window.app.navigateTo('resume-preview');
            if (typeof window.app.showToast === 'function') {
                window.app.showToast(`${name} template applied! Displaying your resume preview.`, 'success');
            }
        }
    };

    window.papUseSelectedTemplate = function() {
        window.papSelectAndUseTemplate(window.papSelectedTemplate || 'Modern');
        if (typeof window.papCloseTemplateModal === 'function') {
            window.papCloseTemplateModal();
        }
    };

    function bindStrengthMeter(inputId, fillId) {
        const inputEl = document.getElementById(inputId);
        const fillEl = document.getElementById(fillId);
        if (!inputEl || !fillEl) return;

        inputEl.addEventListener('input', function() {
            const val = this.value || '';
            if (!val.length) {
                fillEl.className = 'strength-fill';
                fillEl.style.width = '0%';
                return;
            }

            let level = 'weak';
            let pct = '33.33%';

            if (val.length < 6) {
                // Short password -> Red Line (33%)
                level = 'weak';
                pct = '33.33%';
            } else {
                const hasLetters = /[a-zA-Z]/.test(val);
                const hasNumbers = /[0-9]/.test(val);
                const hasSymbols = /[^A-Za-z0-9]/.test(val);

                if ((hasLetters && (hasNumbers || hasSymbols)) || val.length >= 8) {
                    // Correct Valid Password Format -> Full Green Line (100%)
                    level = 'strong';
                    pct = '100%';
                } else {
                    // Basic 6+ character password -> Orange Line (66%)
                    level = 'medium';
                    pct = '66.66%';
                }
            }

            fillEl.className = `strength-fill ${level}`;
            fillEl.style.width = pct;
        });
    }

    function initPasswordStrength() {
        bindStrengthMeter('signup-password', 'pwd-strength-fill');
        bindStrengthMeter('signin-password', 'signin-pwd-strength-fill');
    }

    function setupAuthFormListeners() {
        const signUpForm = document.getElementById('sign-up-form');
        const signInForm = document.getElementById('sign-in-form');

        if (signUpForm) {
            signUpForm.addEventListener('submit', function(e) {
                e.preventDefault();
                const nameInput = document.getElementById('signup-name');
                const emailInput = document.getElementById('signup-email');
                const passInput = document.getElementById('signup-password');

                const name = nameInput ? nameInput.value.trim() : '';
                const email = emailInput ? emailInput.value.trim().toLowerCase() : '';
                const password = passInput ? passInput.value : '';

                if (!email || !password) return;

                let users = {};
                try {
                    users = JSON.parse(localStorage.getItem('resumai_registered_users')) || {};
                } catch(err) { users = {}; }

                const userObj = {
                    name: name || email.split('@')[0],
                    email: email,
                    password: password
                };

                users[email] = userObj;
                localStorage.setItem('resumai_registered_users', JSON.stringify(users));
                localStorage.setItem('resumai_auth_user', JSON.stringify(userObj));
                localStorage.setItem('resumai_auth_session', 'active');

                if (window.app) {
                    window.app.authUser = userObj;
                    if (window.app.profile) window.app.profile.name = userObj.name;
                    window.app.updateAuthUI();
                    if (typeof window.app.showToast === 'function') {
                        window.app.showToast(`Account created! Welcome, ${userObj.name}.`, 'success');
                    }
                    const target = window.app.pendingTargetPage || window.pendingTargetPage || 'dashboard';
                    window.app.pendingTargetPage = null;
                    window.pendingTargetPage = null;
                    window.app.navigateTo(target);
                }
            }, true);
        }

        if (signInForm) {
            signInForm.addEventListener('submit', function(e) {
                e.preventDefault();
                const emailInput = document.getElementById('signin-email');
                const passInput = document.getElementById('signin-password');

                const email = emailInput ? emailInput.value.trim().toLowerCase() : '';
                const password = passInput ? passInput.value : '';

                if (!email) return;

                let users = {};
                try {
                    users = JSON.parse(localStorage.getItem('resumai_registered_users')) || {};
                } catch(err) { users = {}; }

                let userObj = users[email];
                if (!userObj) {
                    const fallbackName = email.split('@')[0];
                    userObj = { name: fallbackName.charAt(0).toUpperCase() + fallbackName.slice(1), email: email, password: password };
                    users[email] = userObj;
                    localStorage.setItem('resumai_registered_users', JSON.stringify(users));
                }

                localStorage.setItem('resumai_auth_user', JSON.stringify(userObj));
                localStorage.setItem('resumai_auth_session', 'active');

                if (window.app) {
                    window.app.authUser = userObj;
                    if (window.app.profile) window.app.profile.name = userObj.name;
                    window.app.updateAuthUI();
                    if (typeof window.app.showToast === 'function') {
                        window.app.showToast(`Signed in successfully as ${userObj.name}!`, 'success');
                    }
                    const target = window.app.pendingTargetPage || window.pendingTargetPage || 'dashboard';
                    window.app.pendingTargetPage = null;
                    window.pendingTargetPage = null;
                    window.app.navigateTo(target);
                }
            }, true);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            patchAppLogin();
            initPasswordStrength();
            setupAuthFormListeners();
        });
    } else {
        patchAppLogin();
        initPasswordStrength();
        setupAuthFormListeners();
    }
    window.addEventListener('load', () => {
        patchAppLogin();
        initPasswordStrength();
        setupAuthFormListeners();
    });
})();
