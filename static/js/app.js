/**
 * Medicinal Plants Database
 * Main application script
 */

// Use strict mode for better error catching and performance
'use strict';

// Toast Notification Manager
class ToastManager {
  constructor() {
    this.toastContainer = this.getOrCreateToastContainer();
  }

  getOrCreateToastContainer() {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      document.body.appendChild(container);
    }
    return container;
  }

  /**
   * Show a toast notification
   * @param {string} message - The message to display
   * @param {string} type - The type of notification ('info', 'success', 'warning', 'error')
   */
  showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <div class="toast-icon"><i class="fas ${this.getIcon(type)}"></i></div>
      <div class="toast-message">${message}</div>
    `;

    this.toastContainer.appendChild(toast);

    // Force reflow to enable transition
    void toast.offsetWidth;
    toast.classList.add('show');

    setTimeout(() => {
      toast.classList.remove('show');
      toast.addEventListener('transitionend', () => toast.remove(), { once: true });
    }, 5000); // Toast visible for 5 seconds
  }

  getIcon(type) {
    switch (type) {
      case 'success': return 'fa-check-circle';
      case 'error': return 'fa-times-circle';
      case 'warning': return 'fa-exclamation-triangle';
      case 'info': return 'fa-info-circle';
      default: return 'fa-info-circle';
    }
  }
}

// Main application class
class MedicinalPlantsApp {
  constructor() {
    console.log('Initializing MedicinalPlantsApp...');

    // DOM Elements
    this.elements = {
      plantsContainer: document.getElementById('plantsContainer'),
      themeToggle: document.getElementById('theme-toggle'),
      mobileMenuToggle: document.querySelector('.mobile-menu-toggle'),
      navMenu: document.getElementById('nav-menu'),
      loadingIndicator: document.querySelector('.loading-indicator'),
      plantsExplorer: document.getElementById('plantsExplorer'),
      cardTemplate: document.getElementById('plant-card-template')
    };

    console.log('Plants container found:', !!this.elements.plantsContainer);
    console.log('Card template found:', !!this.elements.cardTemplate);

    // Application state
    this.state = {
      plants: [],
      filteredPlants: [],
      lastSearchQuery: '',
      isDarkMode: false,
      isLoading: true,
      initialLoad: true,
      activeFilters: {
        medicinalUses: [],
        habitats: [],
        regions: []
      },
      filterOptions: {
        medicinalUses: new Set(),
        habitats: new Set(),
        regions: new Set()
      },
      sortOrder: 'name-asc' // Default sort order
    };

    // Placeholder image for when images fail to load
    this.placeholderImage = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiB2aWV3Qm94PSIwIDAgMjAwIDIwMCI+PHJlY3Qgd2lkdGg9IjIwMCIgaGVpZ2h0PSIyMDAiIGZpbGw9IiNlY2VjZWMiLz48ZyBmaWxsPSIjMmU3ZDMyIj48cGF0aCBkPSJNMTAwIDUwYzAtNSA0LTEwIDEwLTEwaDIwYzUgMCAxMCA0IDEwIDEwdjIwYzAgNS00IDEwLTEwIDEwSDExMGMtNSAwLTEwLTQtMTAtMTBWNTB6Ii8+PHBhdGggZD0iTTg1IDEyMGMxNS0zMCAzMC0zMCA0NSAwIiBzdHJva2U9IiMyZTdkMzIiIHN0cm9rZS13aWR0aD0iNCIgZmlsbD0ibm9uZSIvPjwvZz48dGV4dCB4PSI1MCUiIHk9IjE3MCIgZm9udC1zaXplPSIxNiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iIzJlN2QzMiIgZm9udC1mYW1pbHk9IkFyaWFsLCBzYW5zLXNlcmlmIj5QbGFudCBJbWFnZSBOb3QgQXZhaWxhYmxlPC90ZXh0Pjwvc3ZnPg==';

    // Template
    this.cardTemplate = document.getElementById('plant-card-template');

    // Initialize ToastManager
    this.toastManager = new ToastManager();

    // Initialize the application
    this.init();
  }

  /**
   * Handle initial URL parameters
   */
  handleInitialURL() {
    const urlParams = new URLSearchParams(window.location.search);
    const plantId = urlParams.get('plant');

    if (plantId && this.state.plants.length > 0) {
      const plant = this.state.plants.find(p => p.id === plantId);
      if (plant) {
        this.showPlantDetails(plant);
      }
    }
  }

  /**
   * Initialize the application
   */
  init() {
    console.log('Initializing MedicinalPlantsApp...');

    // Set up event listeners
    this.setupEventListeners();

    // Initialize theme
    this.initializeTheme();

    // Handle direct links to plants
    this.handleUrlParameters();

    // Handle mobile menu
    this.initializeMobileMenu();

    // Auto-hide navbar on scroll
    this.initializeAutoHideNavbar();

    // Check if we're on the plants page
    const isPlantsPage = window.location.pathname.includes('/plants');
    console.log('Is plants page:', isPlantsPage);

    // If on plants page, initialize plants functionality
    if (isPlantsPage && this.elements.plantsContainer) {
      console.log('Initializing plants page...');
      // Make sure plants explorer is visible
      if (this.elements.plantsExplorer) {
        this.elements.plantsExplorer.classList.add('active');
      }
      // Start loading the plants data
      this.fetchPlants();
    } else {
      console.log('Not on plants page, initializing home widgets...');
      this.initializeHomeWidgets();
    }

    // Initialize admin functionality if on admin page
    if (document.querySelector('.admin-layout')) {
      this.initializeAdminFeatures();
    }

    // Display flashed messages as toasts
    this.displayFlashedMessages();
  }

  /**
   * Auto-hide header on scroll down, show on scroll up
   */
  initializeAutoHideNavbar() {
    const header = document.querySelector('header');
    if (!header) return;

    let lastScrollY = window.scrollY;
    let ticking = false;

    const onScroll = () => {
      const currentY = window.scrollY;
      const delta = currentY - lastScrollY;

      // Always show when near top
      if (currentY <= 0 || currentY < 60) {
        header.classList.remove('nav-hidden');
        lastScrollY = currentY;
        ticking = false;
        return;
      }

      // Hide on noticeable scroll down, show on noticeable scroll up
      if (delta > 8) {
        header.classList.add('nav-hidden');
      } else if (delta < -8) {
        header.classList.remove('nav-hidden');
      }

      lastScrollY = currentY;
      ticking = false;
    };

    window.addEventListener('scroll', () => {
      if (!ticking) {
        window.requestAnimationFrame(onScroll);
        ticking = true;
      }
    }, { passive: true });
  }

  /**
   * Initialize admin-specific features
   */
  initializeAdminFeatures() {
    // Add utility functions for admin page
    window.showNotification = this.toastManager.showToast.bind(this.toastManager);
    window.handleBulkAction = this.handleBulkAction.bind(this);
    window.handleImportExport = this.handleImportExport.bind(this);
    window.handleFileImport = this.handleFileImport.bind(this);
  }

  /**
   * Display flashed messages from Flask as toasts
   */
  displayFlashedMessages() {
    const flashedMessagesElement = document.getElementById('flashed-messages');
    if (flashedMessagesElement) {
      try {
        const messages = JSON.parse(flashedMessagesElement.textContent);
        messages.forEach(msg => {
          this.toastManager.showToast(msg.message, msg.category);
        });
      } catch (e) {
        console.error('Error parsing flashed messages:', e);
      }
      flashedMessagesElement.remove(); // Clean up the hidden element
    }
  }

  /**
   * Handle bulk actions for selected items
   * @param {string} action - The action to perform ('delete', 'export', etc.)
   */
  handleBulkAction(action) {
    const selectedItems = document.querySelectorAll('.item-checkbox:checked');
    if (selectedItems.length === 0) {
      this.toastManager.showToast('Please select items to perform bulk actions', 'warning');
      return;
    }

    const itemIds = Array.from(selectedItems).map(item => item.value);

    switch (action) {
      case 'delete':
        if (confirm(`Are you sure you want to delete ${selectedItems.length} items?`)) {
          fetch('/api/plants/bulk-delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: itemIds })
          })
            .then(response => response.json())
            .then(data => {
              if (data.success) {
                this.toastManager.showToast('Items deleted successfully', 'success');
                selectedItems.forEach(item => item.closest('tr').remove());
              } else {
                this.toastManager.showToast(data.error || 'Delete failed', 'error');
              }
            })
            .catch(error => {
              this.toastManager.showToast('Delete failed: ' + error.message, 'error');
            });
        }
        break;
      case 'export':
        window.location.href = `/api/plants/bulk-export?ids=${itemIds.join(',')}`;
        break;
    }
  }

  /**
   * Handle import/export actions
   * @param {string} action - The action to perform ('import' or 'export')
   * @param {string} format - The format for export ('json', 'csv', 'excel', etc.)
   */
  handleImportExport(action, format) {
    switch (action) {
      case 'import':
        document.getElementById('importFile').click();
        break;
      case 'export':
        window.location.href = `/export/${format}`;
        break;
    }
  }

  /**
   * Handle file import
   * @param {HTMLInputElement} input - The file input element
   */
  handleFileImport(input) {
    const file = input.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    fetch('/import', {
      method: 'POST',
      body: formData
    })
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          this.toastManager.showToast('Import successful', 'success');
          setTimeout(() => window.location.reload(), 1500);
        } else {
          this.toastManager.showToast(data.error || 'Import failed', 'error');
        }
      })
      .catch(error => {
        this.toastManager.showToast('Import failed: ' + error.message, 'error');
      });
  }

  /**
   * Set up all event listeners
   */
  /**
   * Handle URL parameters for direct plant access
   */
  handleUrlParameters() {
    const urlParams = new URLSearchParams(window.location.search);
    const plantId = urlParams.get('plant');

    if (plantId) {
      this.showExplorer(true);
    }
  }

  /**
   * Show the plants explorer section
   */
  showExplorer(immediate = false) {
    if (!this.elements.plantsExplorer) return;

    this.elements.plantsExplorer.style.display = 'block';
    if (immediate) {
      this.elements.plantsExplorer.classList.add('active');
      this.fetchPlants();
    } else {
      // Add a small delay to allow the display:block to take effect
      setTimeout(() => {
        this.elements.plantsExplorer.classList.add('active');
        this.fetchPlants();
      }, 50);
    }

    // Smooth scroll to explorer section
    this.elements.plantsExplorer.scrollIntoView({ behavior: 'smooth' });
  }

  setupEventListeners() {
    // Explore button
    if (this.elements.exploreButton) {
      this.elements.exploreButton.addEventListener('click', () => {
        this.showExplorer();
      });
    }

    // Sort select
    const sortSelect = document.getElementById('sortSelect');
    if (sortSelect) {
      sortSelect.addEventListener('change', this.handleSortChange.bind(this));
    }

    // Theme toggle
    if (this.elements.themeToggle) {
      this.elements.themeToggle.addEventListener('change', this.handleThemeToggle.bind(this));
    }

    // Contact form
    if (this.elements.contactForm) {
      this.elements.contactForm.addEventListener('submit', this.handleFormSubmit.bind(this));

      // Field validation feedback
      const formFields = this.elements.contactForm.querySelectorAll('input, textarea');
      formFields.forEach(field => {
        field.addEventListener('blur', this.handleFieldBlur.bind(this));
      });
    }

    // Smooth scrolling for navigation links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', (e) => {
        e.preventDefault();
        const targetId = anchor.getAttribute('href');
        const targetElement = document.querySelector(targetId);

        if (targetElement) {
          targetElement.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
          });

          // Update URL without page reload
          history.pushState(null, '', targetId);
        }
      });
    });

    // Handle keyboard navigation in plant cards
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Tab' && document.activeElement.classList.contains('plant-card')) {
        e.target.classList.add('keyboard-focus');
      }
    });

    // Remove focus styles when using mouse
    document.addEventListener('mousedown', () => {
      document.querySelectorAll('.keyboard-focus').forEach(el => {
        el.classList.remove('keyboard-focus');
      });
    });
  }

  /**
   * Initialize mobile menu behavior
   */
  initializeMobileMenu() {
    const menuOverlay = document.getElementById('menu-overlay');

    const closeMobileMenu = () => {
      this.elements.navMenu.classList.remove('active');
      this.elements.mobileMenuToggle.setAttribute('aria-expanded', 'false');
      if (menuOverlay) {
        menuOverlay.classList.remove('active');
      }
      document.body.style.overflow = '';
      const menuIcon = this.elements.mobileMenuToggle.querySelector('i');
      if (menuIcon) {
        menuIcon.className = 'fas fa-bars';
      }
    };

    if (this.elements.mobileMenuToggle && this.elements.navMenu) {
      // Toggle menu when hamburger icon is clicked
      this.elements.mobileMenuToggle.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent immediate closing from global click listener
        const isExpanded = this.elements.navMenu.classList.toggle('active');
        this.elements.mobileMenuToggle.setAttribute('aria-expanded', isExpanded);

        // Toggle overlay
        if (menuOverlay) {
          menuOverlay.classList.toggle('active');
        }

        // Prevent body scrolling when menu is open
        document.body.style.overflow = isExpanded ? 'hidden' : '';

        // Change icon to X when menu is open
        const menuIcon = this.elements.mobileMenuToggle.querySelector('i');
        if (menuIcon) {
          menuIcon.className = isExpanded ? 'fas fa-times' : 'fas fa-bars';
        }
      });

      // Close menu when clicking on the overlay or outside the nav menu
      document.addEventListener('click', (e) => {
        if (this.elements.navMenu.classList.contains('active') &&
          !this.elements.navMenu.contains(e.target) &&
          e.target !== this.elements.mobileMenuToggle &&
          !this.elements.mobileMenuToggle.contains(e.target)) {
          closeMobileMenu();
        }
      });

      // Close menu when clicking on navigation links
      this.elements.navMenu.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', (e) => {
          // e.stopPropagation(); // Don't stop propagation, let the click go through
          closeMobileMenu();
        });
      });

      // Handle escape key to close the menu
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this.elements.navMenu.classList.contains('active')) {
          closeMobileMenu();
        }
      });
    }
  }

  /**
   * Initialize theme based on user preference or system setting
   */
  initializeTheme() {
    // Do not apply theme logic on admin pages
    if (document.querySelector('.admin-layout')) {
      return;
    }

    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const savedTheme = localStorage.getItem('theme');

    if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
      document.body.classList.add('dark');
      if (this.elements.themeToggle) {
        this.elements.themeToggle.checked = true;
      }
      this.state.isDarkMode = true;
    }

    this.updateThemeIcon();

    // Listen for system theme changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
      if (!localStorage.getItem('theme')) {
        if (e.matches) {
          document.body.classList.add('dark');
          if (this.elements.themeToggle) {
            this.elements.themeToggle.checked = true;
          }
        } else {
          document.body.classList.remove('dark');
          if (this.elements.themeToggle) {
            this.elements.themeToggle.checked = false;
          }
        }
        this.updateThemeIcon();
      }
    });
  }

  /**
   * Update the theme toggle icon
   */
  updateThemeIcon() {
    const sliderIcon = document.querySelector('.slider .icon');
    if (sliderIcon) {
      sliderIcon.textContent = document.body.classList.contains('dark') ? '☀️' : '🌙';
    }
  }

  /**
   * Initialize homepage widgets and charts
   */
  async initializeHomeWidgets() {
    // Populate totals and charts using existing endpoints
    try {
      // Total plants and recent entries
      const plantsRes = await fetch('/api/plants');
      const plants = plantsRes.ok ? await plantsRes.json() : [];
      const totalPlants = plants.length;
      const recent = [...plants]
        .filter(p => p.date_added)
        .sort((a, b) => (b.date_added || '').localeCompare(a.date_added || ''))
        .slice(0, 5);

      const totalPlantsEl = document.getElementById('totalPlantsValue');
      const recentList = document.getElementById('recentPlantsList');
      if (totalPlantsEl) totalPlantsEl.textContent = String(totalPlants);
      if (recentList) {
        recentList.innerHTML = '';
        if (recent.length === 0) {
          recentList.innerHTML = '<li style="color:var(--color-text-light)">No recent additions</li>';
        } else {
          recent.forEach(p => {
            const li = document.createElement('li');
            li.innerHTML = `<i class="fas fa-leaf" style="color:var(--color-primary)"></i> ${this.sanitizeString(p.common_name || p.name || 'Unknown')} <span style="color:var(--color-text-light); font-size:.9em">${p.date_added || ''}</span>`;
            recentList.appendChild(li);
          });
        }
      }

      // Users total from server if available (fallback to 0)
      const usersEl = document.getElementById('totalUsersValue');
      if (usersEl) {
        try {
          const usersRes = await fetch('/admin/api/users', { headers: { 'X-Requested-With': 'fetch' } });
          if (usersRes.ok) {
            const users = await usersRes.json();
            usersEl.textContent = String(users.length);
          } else {
            usersEl.textContent = '0';
          }
        } catch { usersEl.textContent = '0'; }
      }

      // Build trend for last 7 days
      const byDay = {};
      const days = [...Array(7)].map((_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        return d.toISOString().slice(0, 10);
      });
      days.forEach(d => (byDay[d] = 0));
      plants.forEach(p => {
        if (p.date_added && byDay[p.date_added] !== undefined) byDay[p.date_added]++;
      });
      const labels = days;
      const values = days.map(d => byDay[d]);

      const total7 = values.reduce((a, b) => a + b, 0);
      const last7El = document.getElementById('last7DaysCount');
      if (last7El) last7El.textContent = String(total7);

      // Render chart if Chart.js present
      const canvas = document.getElementById('plantTrendChart');
      if (canvas && window.Chart) {
        new window.Chart(canvas.getContext('2d'), {
          type: 'line',
          data: { labels, datasets: [{ label: 'Plants Added', data: values, borderColor: '#2e7d32', backgroundColor: 'rgba(46,125,50,0.1)', tension: 0.3, fill: true }] },
          options: { responsive: true, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: getComputedStyle(document.body).getPropertyValue('--color-text') } }, y: { ticks: { color: getComputedStyle(document.body).getPropertyValue('--color-text') }, beginAtZero: true } } }
        });
      }
    } catch (e) {
      console.error('Failed to initialize home widgets', e);
    }
  }

  /**
   * Handle theme toggle click
   */
  handleThemeToggle() {
    document.body.classList.toggle('dark');
    this.state.isDarkMode = document.body.classList.contains('dark');
    localStorage.setItem('theme', this.state.isDarkMode ? 'dark' : 'light');
    this.updateThemeIcon();
  }

  /**
   * Fetch plant data from API
   */
  async fetchPlants() {
    try {
      this.showLoading(true);
      console.log('Fetching plant data...');
      const response = await fetch('/plants');
      if (!response.ok) {
        throw new Error(`Error: ${response.status} ${response.statusText}`);
      }
      const plants = await response.json();
      console.log('Plant data received:', plants);

      // Make sure we're working with an array
      const plantsArray = Array.isArray(plants) ? plants : Object.values(plants);

      // Process and validate each plant entry
      const processedPlants = plantsArray.map(plant => ({
        ...plant,
        common_name: plant.common_name || plant.name || 'Unknown Plant',
        scientific_name: plant.scientific_name || 'Species unknown',
        description: plant.description || 'No description available',
        medicinal_uses: plant.medicinal_uses || 'Uses not specified',
        parts_used: plant.parts_used || 'Not specified',
        preparation_method: plant.preparation_method || 'Not specified',
        region: plant.region || 'Region not specified',
        precautions: plant.precautions || 'No specific precautions noted',
        image_url: plant.image_url || '/static/images/default_plant.jpg',
        habitat: plant.habitat || 'Habitat not specified'
      }));

      this.state.plants = processedPlants;
      this.renderPlants(processedPlants);
      this.handleInitialURL();
      this.showLoading(false);

    } catch (error) {
      console.error('Error fetching plant data:', error);
      this.showError('Failed to load plant data. Please try refreshing the page.');
      this.showLoading(false);
    }
  }

  /**
   * Show or hide loading state
   */
  showLoading(isLoading) {
    this.state.isLoading = isLoading;

    if (this.elements.loadingIndicator) {
      this.elements.loadingIndicator.style.display = isLoading ? 'flex' : 'none';
    }
  }

  /**
   * Show error message
   */
  showError(message) {
    if (this.elements.plantsContainer) {
      this.elements.plantsContainer.innerHTML = `
        <div class="error-message">
          <i class="fas fa-exclamation-circle" aria-hidden="true"></i>
          <p>${message}</p>
        </div>
      `;
    }
  }

  /**
   * Simplified render method to show all plants
   */
  handleSearch() {
    this.renderPlants(this.state.plants);
  }

  /**
   * Initialize the application without filters
   */
  initializeFilters() {
    // No filtering functionality needed
  }

  /**
   * Render plants to DOM
   */
  renderPlants(plants, isSearching = false, searchQuery = '') {
    if (!this.elements.plantsContainer) {
      console.error('Plants container element not found');
      return;
    }

    // Clear the container
    this.elements.plantsContainer.innerHTML = '';

    // Handle no results
    if (!plants || plants.length === 0) {
      const noResults = document.createElement('div');
      noResults.className = 'no-results';
      noResults.innerHTML = `
        <i class="fas fa-seedling"></i>
        <h3>No plants found</h3>
        <p>Try adjusting your search terms or filters</p>
      `;
      this.elements.plantsContainer.appendChild(noResults);
      this.updateResultCount(0, isSearching);
      return;
    }

    // Create document fragment for better performance
    const fragment = document.createDocumentFragment();

    // Create and append plant cards
    plants.forEach((plant, index) => {
      try {
        const card = this.createPlantCard(plant, index, searchQuery);
        card.style.animationDelay = `${index * 50}ms`;
        fragment.appendChild(card);
      } catch (error) {
        console.error('Error creating plant card:', error, plant);
      }
    });

    // Append all cards at once
    this.elements.plantsContainer.appendChild(fragment);

    // Trigger animation after a small delay
    requestAnimationFrame(() => {
      this.elements.plantsContainer.querySelectorAll('.plant-card').forEach(card => {
        card.classList.add('fade-in');
      });
    });

    // Update result count
    const count = plants.length;
    if (this.elements.resultCount) {
      this.elements.resultCount.textContent = isSearching
        ? `Found ${count} plant${count !== 1 ? 's' : ''}`
        : `Showing all ${count} plants`;
      this.elements.resultCount.style.display = 'block';
    }

    // Hide loading indicator if it exists
    if (this.elements.loadingIndicator) {
      this.elements.loadingIndicator.style.display = 'none';
    }
  }

  /**
   * Add a detail row to plant card with optional highlighting
   */
  addDetailRow(parent, icon, label, value, searchQuery = '') {
    if (!value) return;
    const div = document.createElement('div');
    div.className = 'info';
    const content = searchQuery ? this.highlightText(value, searchQuery) : this.sanitizeString(value);
    div.innerHTML = `
      <span class="label"><i class="fas fa-${icon}" aria-hidden="true"></i> ${label}:</span> 
      ${content}
    `;
    parent.appendChild(div);
  }

  /**
   * Show plant details
   */
  showPlantDetails(plant) {
    const detailsSection = document.getElementById('plantDetails');
    const plantsGrid = document.getElementById('plantsContainer');

    if (!detailsSection || !plantsGrid) return;

    // Update details content
    document.getElementById('plantDetailImage').src = plant.image_url || this.placeholderImage;
    document.getElementById('plantDetailImage').alt = `Photo of ${this.sanitizeString(plant.common_name)}`;
    document.getElementById('plantDetailName').textContent = plant.common_name;
    document.getElementById('plantDetailScientificName').textContent = plant.scientific_name || 'N/A';
    document.getElementById('plantDetailDescription').textContent = plant.description || 'No description available';
    document.getElementById('plantDetailUses').textContent = plant.medicinal_uses || 'No medicinal uses listed';
    document.getElementById('plantDetailParts').textContent = plant.parts_used || 'No information available';
    document.getElementById('plantDetailPreparation').textContent = plant.preparation_method || 'No preparation method listed';
    document.getElementById('plantDetailHabitat').textContent = plant.habitat || 'No habitat information';
    document.getElementById('plantDetailRegion').textContent = plant.region || 'No region specified';
    document.getElementById('plantDetailPrecautions').textContent = plant.precautions || 'No precautions listed';

    // Show related plants
    this.showRelatedPlants(plant);

    // Set up print button
    const printButton = document.getElementById('printPlant');
    if (printButton) {
      printButton.onclick = () => this.printPlantDetails(plant);
    }

    // Set up share button
    const shareButton = document.getElementById('sharePlant');
    if (shareButton) {
      shareButton.onclick = () => this.sharePlantDetails(plant);
    }

    // Hide grid and show details
    plantsGrid.classList.add('hidden');
    detailsSection.classList.add('active');

    // Scroll to top of details
    detailsSection.scrollIntoView({ behavior: 'smooth' });

    // Update URL without page reload
    const url = new URL(window.location.href);
    url.searchParams.set('plant', plant.id);
    window.history.pushState({}, '', url);
  }

  /**
   * Show related plants
   */
  showRelatedPlants(currentPlant) {
    const container = document.getElementById('relatedPlantsContainer');
    if (!container) return;

    // Find related plants based on similar region, habitat, or medicinal uses
    const relatedPlants = this.state.plants
      .filter(plant => plant.id !== currentPlant.id)
      .map(plant => {
        let score = 0;

        // Region match
        if (plant.region === currentPlant.region) score += 3;

        // Habitat match
        if (plant.habitat === currentPlant.habitat) score += 2;

        // Medicinal uses overlap
        const currentUses = (currentPlant.medicinal_uses || '').toLowerCase().split(',').map(u => u.trim());
        const plantUses = (plant.medicinal_uses || '').toLowerCase().split(',').map(u => u.trim());
        const commonUses = currentUses.filter(use => plantUses.includes(use));
        score += commonUses.length;

        return { plant, score };
      })
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)
      .map(item => item.plant);

    // Render related plants
    container.innerHTML = relatedPlants.map(plant => `
      <article class="related-plant-card" onclick="medicinalPlantsApp.showPlantDetails(${JSON.stringify(plant)})">
        <img src="${plant.image_url || this.placeholderImage}" alt="${this.sanitizeString(plant.name)}"
             class="plant-image" style="aspect-ratio: 16/9; object-fit: cover;">
        <div style="padding: var(--spacing-md);">
          <h4 style="margin: 0; font-size: var(--font-size-base);">${this.sanitizeString(plant.name)}</h4>
          <p style="margin: 0; font-size: var(--font-size-sm); color: var(--color-text-light);">
            ${this.sanitizeString(plant.scientific_name || '')}
          </p>
        </div>
      </article>
    `).join('');
  }

  /**
   * Print plant details
   */
  printPlantDetails(plant) {
    // Create print window
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      this.toastManager.showToast('Please allow pop-ups to print plant information', 'warning');
      return;
    }

    // Generate print content
    const content = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${plant.name} - Medicinal Plant Details</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; max-width: 800px; margin: 2rem auto; padding: 0 1rem; }
          img { max-width: 100%; height: auto; border-radius: 8px; }
          h1 { color: #2e7d32; margin-bottom: 0.5rem; }
          .scientific-name { font-style: italic; color: #666; margin-bottom: 2rem; }
          .section { margin-bottom: 1.5rem; }
          .section h2 { color: #1b5e20; font-size: 1.2rem; margin-bottom: 0.5rem; }
          .warning { background: #fff3e0; padding: 1rem; border-radius: 4px; }
          @media print {
            body { margin: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="no-print" style="margin-bottom: 2rem;">
          <button onclick="window.print()">Print</button>
          <button onclick="window.close()">Close</button>
        </div>

        <img src="${plant.image_url || this.placeholderImage}" alt="${plant.name}">
        <h1>${plant.name}</h1>
        <div class="scientific-name">${plant.scientific_name || 'Scientific name not available'}</div>

        <div class="section">
          <h2>Description</h2>
          <p>${plant.description || 'No description available'}</p>
        </div>

        <div class="section">
          <h2>Medicinal Uses</h2>
          <p>${plant.medicinal_uses || 'No medicinal uses listed'}</p>
        </div>

        <div class="section">
          <h2>Parts Used</h2>
          <p>${plant.parts_used || 'No information available'}</p>
        </div>

        <div class="section">
          <h2>Preparation Method</h2>
          <p>${plant.preparation_method || 'No preparation method listed'}</p>
        </div>

        <div class="section">
          <h2>Habitat & Region</h2>
          <p><strong>Habitat:</strong> ${plant.habitat || 'No habitat information'}</p>
          <p><strong>Region:</strong> ${plant.region || 'No region specified'}</p>
        </div>

        <div class="section warning">
          <h2>Precautions</h2>
          <p>${plant.precautions || 'No precautions listed'}</p>
        </div>

        <div class="no-print" style="margin-top: 2rem; color: #666; font-size: 0.9rem;">
          Generated from Medicinal Plants Database on ${new Date().toLocaleDateString()}
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(content);
    printWindow.document.close();
  }

  /**
   * Share plant details
   */
  async sharePlantDetails(plant) {
    const url = new URL(window.location.href);
    url.searchParams.set('plant', plant.id);
    const shareData = {
      title: `${plant.name} - Medicinal Plant Information`,
      text: `Learn about the medicinal properties of ${plant.name} (${plant.scientific_name || 'Scientific name not available'})`,
      url: url.toString()
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        // Fallback to copying to clipboard
        await navigator.clipboard.writeText(url.toString());
        this.toastManager.showToast('Link copied to clipboard!', 'success');
      }
    } catch (error) {
      console.error('Error sharing:', error);
      this.toastManager.showToast('Failed to share plant information', 'error');
    }
  }

  /**
   * Hide plant details
   */
  hidePlantDetails() {
    const detailsSection = document.getElementById('plantDetails');
    const plantsGrid = document.getElementById('plantsContainer');

    if (!detailsSection || !plantsGrid) return;

    // Hide details and show grid
    detailsSection.classList.remove('active');
    plantsGrid.classList.remove('hidden');

    // Remove plant ID from URL
    const url = new URL(window.location.href);
    url.searchParams.delete('plant');
    window.history.pushState({}, '', url);
  }

  /**
   * Create a plant card element
   */
  createPlantCard(plant, index, searchQuery = '') {
    // Use the template if available, otherwise create element
    let card;

    if (this.cardTemplate) {
      card = document.importNode(this.cardTemplate.content, true).querySelector('.plant-card');

      // Add click handler to show details
      card.addEventListener('click', () => this.showPlantDetails(plant));
      card.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.showPlantDetails(plant);
        }
      });

      // Create image container and set up image
      const imageContainer = document.createElement('div');
      imageContainer.className = 'plant-image-container';

      const imageElement = document.createElement('img');
      imageElement.className = 'plant-image loading';
      imageElement.alt = `Photo of ${this.sanitizeString(plant.common_name)}`;
      imageElement.loading = index > 5 ? 'lazy' : 'eager';

      // Try first with the provided image URL
      const imageUrl = plant.image_url || this.placeholderImage;
      imageElement.src = this.sanitizeString(imageUrl);

      // Add error handling for images
      imageElement.onerror = () => {
        imageElement.src = defaultImage;
        imageElement.alt = 'Plant image not available';
        imageElement.classList.add('error');
      };

      // Remove loading class when image loads successfully
      imageElement.onload = () => {
        imageElement.classList.remove('loading');
      };

      imageContainer.appendChild(imageElement);

      // Replace the existing image with the container
      const existingImage = card.querySelector('.plant-image');
      if (existingImage) {
        existingImage.parentNode.replaceChild(imageContainer, existingImage);
      } else {
        card.insertBefore(imageContainer, card.firstChild);
      }

      // Set main content
      card.querySelector('.plant-name').innerHTML = `<i class="fas fa-leaf" aria-hidden="true"></i> ${this.sanitizeString(plant.common_name)}`;
      card.querySelector('.sci-name').innerHTML = `<i class="fas fa-flask" aria-hidden="true"></i> ${this.sanitizeString(plant.scientific_name)}`;

      // Add details
      const detailsElement = card.querySelector('.plant-details');

      this.addDetailRow(detailsElement, 'capsules', 'Medicinal Uses', plant.medicinal_uses, searchQuery);
      this.addDetailRow(detailsElement, 'info-circle', 'Description', plant.description, searchQuery);
      this.addDetailRow(detailsElement, 'globe-asia', 'Habitat', plant.habitat, searchQuery);
      this.addDetailRow(detailsElement, 'mortar-pestle', 'Preparation Method', plant.preparation_method, searchQuery);
      this.addDetailRow(detailsElement, 'leaf', 'Parts Used', plant.parts_used, searchQuery);
      this.addDetailRow(detailsElement, 'map-marker-alt', 'Region', plant.region, searchQuery);
      this.addDetailRow(detailsElement, 'exclamation-triangle', 'Precautions', plant.precautions, searchQuery);
    } else {
      // Fallback if template not available
      card = document.createElement('div');
      card.className = 'plant-card';
      card.setAttribute('tabindex', '0');
      card.style.animationDelay = `${index * 0.05}s`;

      const imageContainer = document.createElement('div');
      imageContainer.className = 'plant-image-container';

      const imageElement = document.createElement('img');
      imageElement.className = 'plant-image';
      imageElement.src = this.sanitizeString(plant.image_url);
      imageElement.alt = `Photo of ${this.sanitizeString(plant.name)}`;
      imageElement.loading = index > 5 ? 'lazy' : 'eager';

      // Add error handling for images
      imageElement.onerror = () => {
        imageElement.src = this.placeholderImage;
        imageElement.alt = 'Image not available';
        imageElement.classList.add('error');
      };

      imageContainer.appendChild(imageElement);

      card.innerHTML = `
        <div class="card-content">
          <h3 class="plant-name"><i class="fas fa-leaf" aria-hidden="true"></i> ${this.sanitizeString(plant.common_name)}</h3>
          <div class="sci-name"><i class="fas fa-flask" aria-hidden="true"></i> ${this.sanitizeString(plant.scientific_name)}</div>
          <div class="plant-details">
            <div class="info"><span class="label"><i class="fas fa-capsules" aria-hidden="true"></i> Medicinal Uses:</span> ${this.sanitizeString(plant.medicinal_uses)}</div>
            <div class="info"><span class="label"><i class="fas fa-info-circle" aria-hidden="true"></i> Description:</span> ${this.sanitizeString(plant.description)}</div>
            <div class="info"><span class="label"><i class="fas fa-globe-asia" aria-hidden="true"></i> Habitat:</span> ${this.sanitizeString(plant.habitat)}</div>
          </div>
        </div>
      `;

      // Insert the image container at the beginning
      card.insertBefore(imageContainer, card.firstChild);
    }

    // Add animation delay based on index for staggered animation
    card.style.animationDelay = `${index * 0.05}s`;

    // Make cards focusable for keyboard navigation
    card.setAttribute('tabindex', '0');

    return card;
  }

  /**
   * Add a detail row to plant card
   */
  addDetailRow(parent, icon, label, value) {
    if (!value) return; // Only add if value exists
    const div = document.createElement('div');
    div.className = 'info';
    div.innerHTML = `
      <span class="label"><i class="fas fa-${icon}" aria-hidden="true"></i> ${label}:</span> 
      ${this.sanitizeString(value)}
    `;
    parent.appendChild(div);
  }

  /**
   * Update the result count display
   */
  updateResultCount(count, isSearching) {
    if (!this.elements.resultCount) return;

    if (isSearching) {
      this.elements.resultCount.textContent = `${count} plant${count === 1 ? '' : 's'} found`;
      this.elements.resultCount.style.display = 'inline-block';
    } else {
      this.elements.resultCount.textContent = this.state.initialLoad ? '' : 'Showing all plants';
      this.elements.resultCount.style.display = this.state.initialLoad ? 'none' : 'inline-block';
    }
  }

  /**
   * Handle form field blur for validation feedback
   */
  handleFieldBlur(event) {
    const field = event.target;

    if (field.value.trim()) {
      field.classList.add('has-content');
    } else {
      field.classList.remove('has-content');
    }
  }

  /**
   * Handle form submission
   */
  handleFormSubmit(event) {
    event.preventDefault();

    // Reset previous error states
    this.resetFormErrors();

    // Get form data
    const name = document.getElementById('name').value.trim();
    const email = document.getElementById('email').value.trim();
    const message = document.getElementById('message').value.trim();

    // Validate form fields
    let isValid = true;

    if (!name) {
      this.showFieldError('name', 'Please enter your name');
      isValid = false;
    }

    if (!email) {
      this.showFieldError('email', 'Please enter your email address');
      isValid = false;
    } else if (!this.isValidEmail(email)) {
      this.showFieldError('email', 'Please enter a valid email address');
      isValid = false;
    }

    if (!message) {
      this.showFieldError('message', 'Please enter your message');
      isValid = false;
    }

    // Show form-level error if invalid
    if (!isValid) {
      this.showFormStatus('error', 'Please fix the errors above.');
      return;
    }

    // Show success message (in a real app, this would submit the form)
    this.showFormStatus('success', 'Thank you for your message! (Demo only, not sent)');

    // Reset form
    this.elements.contactForm.reset();

    // Remove content classes
    this.elements.contactForm.querySelectorAll('.has-content').forEach(el => {
      el.classList.remove('has-content');
    });
  }

  /**
   * Reset form errors
   */
  resetFormErrors() {
    if (!this.elements.formStatus) return;

    this.elements.formStatus.textContent = '';
    this.elements.formStatus.className = 'form-status';

    // Remove field errors
    document.querySelectorAll('.field-error').forEach(el => el.remove());
  }

  /**
   * Show form status message
   */
  showFormStatus(type, message) {
    if (!this.elements.formStatus) return;

    this.elements.formStatus.textContent = message;
    this.elements.formStatus.className = `form-status ${type}`;
  }

  /**
   * Show field-level error
   */
  showFieldError(fieldId, message) {
    const field = document.getElementById(fieldId);
    if (!field) return;

    // Create error element
    const errorDiv = document.createElement('div');
    errorDiv.className = 'field-error';
    errorDiv.textContent = message;

    // Add after the field
    field.parentNode.insertBefore(errorDiv, field.nextSibling);

    // Focus the first field with error
    if (document.querySelectorAll('.field-error').length === 1) {
      field.focus();
    }
  }

  /**
   * Validate email format
   */
  isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  /**
   * Sanitize string to prevent XSS attacks
   */
  sanitizeString(str) {
    if (!str) return '';

    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /**
   * Debounce function to limit rapid function calls
   */
  debounce(func, wait) {
    let timeout;

    return function executedFunction(...args) {
      const context = this;

      const later = () => {
        timeout = null;
        func.apply(context, args);
      };

      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }
}

// Get URL parameters
const urlParams = new URLSearchParams(window.location.search);
const initialQuery = urlParams.get('q');

// Initialize the application when DOM is loaded
let medicinalPlantsApp;
document.addEventListener('DOMContentLoaded', () => {
  medicinalPlantsApp = new MedicinalPlantsApp();
});