class PixKeySelector {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        this.onSuccess = options.onSuccess || (() => { });
        this.onError = options.onError || (() => { });
        this.currentType = 'cpf';
        this.render();
        this.attachEvents();
    }

    render() {
        this.container.innerHTML = `
            <div class="pix-key-selector">
                <style>
                    .pix-radio-group { display: flex; gap: 8px; margin-bottom: 20px; flex-wrap: wrap; }
                    .pix-radio-label { 
                        display: flex; align-items: center; justify-content: center; padding: 10px 14px; 
                        border: 1px solid var(--border); border-radius: 8px; cursor: pointer; 
                        background: var(--bg-input); color: var(--text-secondary); transition: all 0.2s;
                        font-weight: 500; font-size: 0.85rem; flex: 1; min-width: 90px;
                    }
                    .pix-radio-label:hover { border-color: var(--primary); color: var(--primary); background: rgba(255, 79, 163, 0.05); }
                    .pix-radio-input { display: none; }
                    .pix-radio-input:checked + .pix-radio-label {
                        background: var(--primary); color: white; border-color: var(--primary); box-shadow: 0 4px 12px rgba(139,0,75,0.2);
                    }
                    .pix-suggestions {
                        position: absolute; width: 100%; top: calc(100% + 4px); left: 0;
                        background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px;
                        box-shadow: 0 8px 24px rgba(0,0,0,0.12); z-index: 100;
                        max-height: 200px; overflow-y: auto; display: none;
                    }
                    .pix-suggestion-item {
                        padding: 12px 16px; cursor: pointer; font-size: 0.875rem; color: var(--text-primary);
                        border-bottom: 1px solid var(--border-light);
                    }
                    .pix-suggestion-item:last-child { border-bottom: none; }
                    .pix-suggestion-item:hover { background: var(--bg); color: var(--primary); font-weight: 600; }
                </style>

                <div class="form-group">
                    <label class="form-label" style="font-weight:600; margin-bottom:12px; display:flex; align-items:center; gap:8px;">
                        <svg width="24" height="24" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path fill="var(--primary)" d="M125.8 238.1l42.3-42.3-33.1-33.1c-13.7-13.7-35.8-13.7-49.5 0l-57.8 57.8c-13.7 13.7-13.7 35.8 0 49.5l57.8 57.8c13.7 13.7 35.8 13.7 49.5 0l33.1-33.1-42.3-42.3-15.5 15.5c-5.2 5.2-13.6 5.2-18.8 0l-28.5-28.5c-5.2-5.2-5.2-13.6 0-18.8l28.5-28.5c5.2-5.2 13.6-5.2 18.8 0L125.8 238.1zM386.2 273.9l-42.3 42.3 33.1 33.1c13.7 13.7 35.8 13.7 49.5 0l57.8-57.8c13.7-13.7 13.7-35.8 0-49.5l-57.8-57.8c-13.7-13.7-35.8-13.7-49.5 0l-33.1 33.1 42.3 42.3 15.5-15.5c5.2-5.2 13.6-5.2 18.8 0l28.5 28.5c5.2 5.2 5.2 13.6 0 18.8l-28.5 28.5c-5.2 5.2-13.6 5.2-18.8 0L386.2 273.9zM256 122.9l69.7 69.7 43.1-43.1c-29.3-29.3-66-48.4-105.7-54V21.1C325.2 30.6 384 66.8 427 109.8l-43.1 43.1-71-71c-15.4-15.4-40.4-15.4-55.8 0l-71 71-43.1-43.1C186 66.8 244.8 30.6 307.1 21.1v74.4c-39.7 5.6-76.4 24.7-105.7 54l43.1 43.1 69.7-69.7h1.8zM256 389.1l-69.7-69.7-43.1 43.1c29.3 29.3 66 48.4 105.7 54v74.4c-62.3-9.5-121.1-45.7-164.1-88.7l43.1-43.1 71 71c15.4 15.4 40.4 15.4 55.8 0l71-71 43.1 43.1c-43 43-101.8 79.2-164.1 88.7v-74.4c39.7-5.6 76.4-24.7 105.7-54l-43.1-43.1L256 389.1h-0.2z"/>
                        </svg>
                        Selecione o Tipo de Chave Pix
                    </label>
                    <div class="pix-radio-group">
                        <input type="radio" id="pix_cpf" name="pixType" class="pix-radio-input" value="cpf" checked>
                        <label for="pix_cpf" class="pix-radio-label">CPF</label>

                        <input type="radio" id="pix_cnpj" name="pixType" class="pix-radio-input" value="cnpj">
                        <label for="pix_cnpj" class="pix-radio-label">CNPJ</label>

                        <input type="radio" id="pix_email" name="pixType" class="pix-radio-input" value="email">
                        <label for="pix_email" class="pix-radio-label">E-mail</label>

                        <input type="radio" id="pix_random" name="pixType" class="pix-radio-input" value="random">
                        <label for="pix_random" class="pix-radio-label">Chave Aleatória</label>
                    </div>
                </div>

                <div class="form-group" style="position: relative;">
                    <label class="form-label" id="pixKeyLabel">Chave CPF</label>
                    <input type="text" id="pixKeyValue" class="form-input" placeholder="000.000.000-00" autocomplete="off" />
                    <div id="pixEmailSuggestions" class="pix-suggestions"></div>
                    <div id="pixErrorText" style="color:var(--danger); font-size:12px; font-weight:500; margin-top:6px; display:none;"></div>
                </div>

                <div style="display:flex; justify-content:space-between; margin-top:24px; padding-top:20px; border-top:1px solid var(--border);">
                    <button type="button" class="btn btn-ghost" id="pixBtnBack">Voltar</button>
                    <button type="button" class="btn btn-primary" id="pixBtnSubmit" disabled>Cadastrar Chave</button>
                </div>
            </div>
        `;

        this.input = this.container.querySelector('#pixKeyValue');
        this.label = this.container.querySelector('#pixKeyLabel');
        this.suggestionsBox = this.container.querySelector('#pixEmailSuggestions');
        this.errorText = this.container.querySelector('#pixErrorText');
        this.submitBtn = this.container.querySelector('#pixBtnSubmit');
        this.backBtn = this.container.querySelector('#pixBtnBack');
    }

    attachEvents() {
        const radios = this.container.querySelectorAll('.pix-radio-input');
        radios.forEach(r => {
            r.addEventListener('change', (e) => {
                this.currentType = e.target.value;
                this.input.value = '';
                this.errorText.style.display = 'none';
                this.submitBtn.disabled = true;
                this.suggestionsBox.style.display = 'none';

                if (this.currentType === 'cpf') {
                    this.label.textContent = 'Chave CPF';
                    this.input.placeholder = '000.000.000-00';
                    this.input.maxLength = 14;
                } else if (this.currentType === 'cnpj') {
                    this.label.textContent = 'Chave CNPJ';
                    this.input.placeholder = '00.000.000/0000-00';
                    this.input.maxLength = 18;
                } else if (this.currentType === 'email') {
                    this.label.textContent = 'Chave E-mail';
                    this.input.placeholder = 'nome@dominio.com';
                    this.input.removeAttribute('maxLength');
                } else {
                    this.label.textContent = 'Chave Aleatória (EVP)';
                    this.input.placeholder = '123e4567-e89b-12d3-a456-426655440000';
                    this.input.maxLength = 36;
                }
            });
        });

        this.input.addEventListener('input', (e) => this.handleInput(e));

        document.addEventListener('click', (e) => {
            if (!this.input.contains(e.target) && !this.suggestionsBox.contains(e.target)) {
                this.suggestionsBox.style.display = 'none';
            }
        });

        this.submitBtn.addEventListener('click', () => this.handleSubmit());
        this.backBtn.addEventListener('click', () => {
            this.input.value = '';
            this.errorText.style.display = 'none';
            this.submitBtn.disabled = true;
            if (window.BC && BC.modal) BC.modal.close('gwModal');
        });
    }

    handleInput(e) {
        let val = e.target.value;

        if (this.currentType === 'cpf') {
            val = val.replace(/\D/g, '');
            if (val.length > 3) val = val.substring(0, 3) + '.' + val.substring(3);
            if (val.length > 7) val = val.substring(0, 7) + '.' + val.substring(7);
            if (val.length > 11) val = val.substring(0, 11) + '-' + val.substring(11, 13);
            this.input.value = val;
        } else if (this.currentType === 'cnpj') {
            val = val.replace(/\D/g, '');
            if (val.length > 2) val = val.substring(0, 2) + '.' + val.substring(2);
            if (val.length > 6) val = val.substring(0, 6) + '.' + val.substring(6);
            if (val.length > 10) val = val.substring(0, 10) + '/' + val.substring(10);
            if (val.length > 15) val = val.substring(0, 15) + '-' + val.substring(15, 17);
            this.input.value = val;
        } else if (this.currentType === 'email') {
            const domains = ['@gmail.com', '@hotmail.com', '@yahoo.com.br', '@yahoo.com', '@outlook.com', '@protonmail.com', '@icloud.com'];
            if (val.includes('@')) {
                const parts = val.split('@');
                const searchDomain = '@' + parts[1].toLowerCase();
                const matches = domains.filter(d => d.startsWith(searchDomain) && searchDomain !== d);

                if (matches.length > 0) {
                    this.suggestionsBox.innerHTML = matches.map(d => `<div class="pix-suggestion-item">${parts[0]}${d}</div>`).join('');
                    this.suggestionsBox.style.display = 'block';

                    const items = this.suggestionsBox.querySelectorAll('.pix-suggestion-item');
                    items.forEach(item => {
                        item.addEventListener('click', () => {
                            this.input.value = item.textContent;
                            this.suggestionsBox.style.display = 'none';
                            this.validate();
                        });
                    });
                } else {
                    this.suggestionsBox.style.display = 'none';
                }
            } else {
                this.suggestionsBox.style.display = 'none';
            }
        }

        this.validate();
    }

    validateCpf(cpf) {
        cpf = cpf.replace(/[^\d]+/g, '');
        if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
        let p1 = 0, p2 = 0;
        for (let i = 0; i < 9; i++) p1 += parseInt(cpf.charAt(i)) * (10 - i);
        let rev = 11 - (p1 % 11);
        if (rev === 10 || rev === 11) rev = 0;
        if (rev !== parseInt(cpf.charAt(9))) return false;
        for (let i = 0; i < 10; i++) p2 += parseInt(cpf.charAt(i)) * (11 - i);
        rev = 11 - (p2 % 11);
        if (rev === 10 || rev === 11) rev = 0;
        if (rev !== parseInt(cpf.charAt(10))) return false;
        return true;
    }

    validateCnpj(cnpj) {
        cnpj = cnpj.replace(/[^\d]+/g, '');
        if (cnpj.length !== 14 || /^(\d)\1+$/.test(cnpj)) return false;
        let size = cnpj.length - 2;
        let numbers = cnpj.substring(0, size);
        let digits = cnpj.substring(size);
        let sum = 0, pos = size - 7;
        for (let i = size; i >= 1; i--) {
            sum += numbers.charAt(size - i) * pos--;
            if (pos < 2) pos = 9;
        }
        let result = sum % 11 < 2 ? 0 : 11 - sum % 11;
        if (result != digits.charAt(0)) return false;
        size = size + 1;
        numbers = cnpj.substring(0, size);
        sum = 0; pos = size - 7;
        for (let i = size; i >= 1; i--) {
            sum += numbers.charAt(size - i) * pos--;
            if (pos < 2) pos = 9;
        }
        result = sum % 11 < 2 ? 0 : 11 - sum % 11;
        if (result != digits.charAt(1)) return false;
        return true;
    }

    validate() {
        const val = this.input.value;
        let isValid = false;
        this.errorText.style.display = 'none';

        if (!val) {
            this.submitBtn.disabled = true;
            return false;
        }

        if (this.currentType === 'cpf') {
            isValid = val.length === 14 && this.validateCpf(val);
            if (!isValid && val.length === 14) {
                this.errorText.textContent = 'CPF digitado é inválido. Verifique os números.';
                this.errorText.style.display = 'block';
            }
        } else if (this.currentType === 'cnpj') {
            isValid = val.length === 18 && this.validateCnpj(val);
            if (!isValid && val.length === 18) {
                this.errorText.textContent = 'CNPJ digitado é inválido.';
                this.errorText.style.display = 'block';
            }
        } else if (this.currentType === 'email') {
            const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            isValid = regex.test(val);
            if (!isValid && val.includes('@') && val.split('@')[1].includes('.')) {
                this.errorText.textContent = 'Formato de e-mail inválido.';
                this.errorText.style.display = 'block';
            }
        } else if (this.currentType === 'random') {
            isValid = val.length >= 32;
            if (!isValid && val.length > 5) {
                this.errorText.textContent = 'Chave aleatória deve conter no mínimo 32 caracteres (Ex: UUID).';
                this.errorText.style.display = 'block';
            }
        }

        this.submitBtn.disabled = !isValid;
        return isValid;
    }

    async handleSubmit() {
        if (!this.validate()) return;

        const key = this.input.value;
        const type = this.currentType;

        this.submitBtn.disabled = true;
        this.input.disabled = true;
        const radios = this.container.querySelectorAll('.pix-radio-input');
        radios.forEach(r => r.disabled = true);

        const originalText = this.submitBtn.textContent;
        this.submitBtn.innerHTML = '<div class="loader" style="border-top-color:#fff; border-color:rgba(255,255,255,0.3)"></div> Processando...';

        try {
            await this.simulateBacenAPI(key);
            this.submitBtn.innerHTML = 'Cadastrado com sucesso';
            this.onSuccess(key, type);
        } catch (error) {
            this.submitBtn.innerHTML = originalText;
            this.submitBtn.disabled = false;
            this.input.disabled = false;
            radios.forEach(r => r.disabled = false);
            this.errorText.textContent = error.message || 'Falha ao comunicar com Banco Central.';
            this.errorText.style.display = 'block';
            this.onError(error);
        }
    }

    simulateBacenAPI(key) {
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                if (key.toLowerCase().includes('erro')) {
                    reject(new Error("Chave rejeitada pelo Banco Central (DICT). A chave informada encontra-se inativa ou inexistente."));
                } else {
                    resolve({ status: "success", key });
                }
            }, 2000);
        });
    }
}
