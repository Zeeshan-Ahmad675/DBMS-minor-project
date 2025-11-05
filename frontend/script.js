document.addEventListener('DOMContentLoaded', () => {
    const BACKEND_URL = "https://localhost:8000";
    // Screens
    const dbSetupScreen = document.getElementById('db-setup-screen');
    const mainAppScreen = document.getElementById('main-app-screen');

    // DB Setup Buttons and Sections
    const showCreateDbBtn = document.getElementById('show-create-db-btn');
    const showChooseDbBtn = document.getElementById('show-choose-db-btn');
    const createDbSection = document.getElementById('create-db-section');
    const chooseDbSection = document.getElementById('choose-db-section');
    const createDbBtn = document.getElementById('create-db-btn');
    const chooseDbBtn = document.getElementById('choose-db-btn');
    const dbInitialChoice = document.getElementById('db-initial-choice');

    let currentDatabase = '';

    // --- Step 1: Database Setup Flow ---

    showCreateDbBtn.addEventListener('click', () => {
        dbInitialChoice.classList.add('hidden');
        createDbSection.classList.remove('hidden');
    });

    showChooseDbBtn.addEventListener('click', () => {
        dbInitialChoice.classList.add('hidden');
        chooseDbSection.classList.remove('hidden');
        // Aap yahan backend se database list fetch kar sakte hain
    });

    

    chooseDbBtn.addEventListener('click', () => {
        const dbName = document.getElementById('existing-db-list').value;
        currentDatabase = dbName;
        console.log(`Choosing existing database '${dbName}'.`);
        startMainApp();
    });
    
    function startMainApp() {
        // Switch screens
        dbSetupScreen.classList.remove('active');
        mainAppScreen.classList.add('active');
        document.getElementById('main-app-title').textContent = `Managing: ${currentDatabase}`;
        
        // Initialize the CRUD interface
        setupCrudInterface();
    }


    // --- Step 2: Main App CRUD Interface ---

    function setupCrudInterface() {
        const navButtons = document.querySelectorAll('.nav-btn');
        const pages = document.querySelectorAll('.page');

        // Navigation between tabs
        navButtons.forEach(button => {
            button.addEventListener('click', () => {
                navButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                pages.forEach(page => page.classList.remove('active'));
                document.getElementById(button.dataset.target).classList.add('active');
            });
        });

        // Setup CRUD for each entity
        setupEntity('student', ['name', 'email']);
        setupEntity('faculty', ['name', 'position']);
        setupEntity('course', ['name', 'credits']);
        setupEntity('department', ['name']);
    }

    function setupEntity(entityName, fields) {
        const form = document.getElementById(`${entityName}-form`);
        const tableBody = document.getElementById(`${entityName}s-table`).querySelector('tbody');
        const idField = document.getElementById(`${entityName}-id`);
        const formFields = fields.map(f => document.getElementById(`${entityName}-${f}`));
        const submitButton = form.querySelector('button');

        async function refreshTable() {
            tableBody.innerHTML = '';
            // Backend se data fetch karein
            const data = await api.read(`${entityName}s`);
            data.forEach(item => {
                const row = document.createElement('tr');
                fields.forEach(field => {
                    const cell = document.createElement('td');
                    cell.textContent = item[field];
                    row.appendChild(cell);
                });

                const actionsCell = createActionButtons(item);
                row.appendChild(actionsCell);
                tableBody.appendChild(row);
            });
        }
        
        function createActionButtons(item) {
             const actionsCell = document.createElement('td');
             actionsCell.className = 'actions';
             const editButton = document.createElement('button');
             editButton.textContent = 'Edit';
             editButton.className = 'edit-btn';
             editButton.onclick = () => {
                 idField.value = item.id;
                 fields.forEach((field, index) => formFields[index].value = item[field]);
                 submitButton.textContent = `Update ${entityName.charAt(0).toUpperCase() + entityName.slice(1)}`;
             };
             const deleteButton = document.createElement('button');
             deleteButton.textContent = 'Delete';
             deleteButton.className = 'delete-btn';
             deleteButton.onclick = async () => {
                 if (confirm('Are you sure you want to delete this entry?')) {
                     await api.delete(`${entityName}s`, item.id);
                     refreshTable();
                 }
             };
             actionsCell.appendChild(editButton);
             actionsCell.appendChild(deleteButton);
             return actionsCell;
        }

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const data = {};
            fields.forEach((field, index) => data[field] = formFields[index].value);
            const id = idField.value;

            if (id) { // Update
                await api.update(`${entityName}s`, id, data);
            } else { // Create
                await api.create(`${entityName}s`, data);
            }

            form.reset();
            idField.value = '';
            submitButton.textContent = `Add ${entityName.charAt(0).toUpperCase() + entityName.slice(1)}`;
            refreshTable();
        });

        refreshTable();
    }
    
    // --- Mock API for demonstration ---
    // Isko apne asli backend API calls se replace karein
    const mockDb = { students: [], faculty: [], courses: [], departments: [] };
    const api = {
        create: (endpoint, data) => {
            const id = Date.now();
            mockDb[endpoint].push({ id, ...data });
            console.log('Mock API Create:', mockDb[endpoint]);
            return Promise.resolve({ id, ...data });
        },
        read: (endpoint) => {
            console.log('Mock API Read:', mockDb[endpoint]);
            return Promise.resolve(mockDb[endpoint]);
        },
        update: (endpoint, id, data) => {
            const itemIndex = mockDb[endpoint].findIndex(item => item.id == id);
            if (itemIndex > -1) mockDb[endpoint][itemIndex] = { ...mockDb[endpoint][itemIndex], ...data };
            console.log('Mock API Update:', mockDb[endpoint]);
            return Promise.resolve({ id, ...data });
        },
        delete: (endpoint, id) => {
            mockDb[endpoint] = mockDb[endpoint].filter(item => item.id != id);
            console.log('Mock API Delete:', mockDb[endpoint]);
            return Promise.resolve();
        }
    };
});