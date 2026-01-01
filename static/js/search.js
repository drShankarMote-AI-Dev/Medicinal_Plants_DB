// Load comparison cart from localStorage on startup
let comparisonCart = JSON.parse(localStorage.getItem('plantComparison')) || [];

document.addEventListener('DOMContentLoaded', function () {
    const searchForm = document.getElementById('heroSearchForm');
    const searchInput = document.getElementById('heroSearch');
    const searchSuggestions = document.getElementById('searchSuggestions');
    const sortFilter = document.getElementById('sortFilter');
    const hasImageFilter = document.getElementById('hasImageFilter');
    const activeFiltersContainer = document.querySelector('.search-active-filters');
    const regionFilterOptions = document.getElementById('region-filter-options');
    const habitatFilterOptions = document.getElementById('habitat-filter-options');
    const preparationFilterOptions = document.getElementById('preparation-filter-options');
    const partsFilterOptions = document.getElementById('parts-filter-options');
    const usesFilterOptions = document.getElementById('uses-filter-options');
    const safePregnancyFilter = document.getElementById('safePregnancyFilter');
    const noInteractionsFilter = document.getElementById('noInteractionsFilter');
    const resultsGrid = document.getElementById('resultsGrid');
    const resultsInfo = document.getElementById('resultsInfo');
    const paginationContainer = document.getElementById('paginationContainer');

    // Initial search state
    let currentSearch = {
        query: searchInput ? searchInput.value : '',
        page: 1,
        filters: {},
        sort: 'relevance'
    };

    // Store current plant data for expand/collapse
    let currentPlantsData = [];

    // State variables for suggestions navigation
    let suggestionIndex = -1;
    let currentSuggestions = [];
    let suggestionsLoading = false;

    // Initialize advanced features
    initializeAdvancedFeatures();

    // Populate filter options from backend data
    const populateFilterOptions = () => {
        const filterData = window.filterData || {};

        // Populate Region filters
        if (regionFilterOptions && filterData.regions) {
            regionFilterOptions.innerHTML = filterData.regions.map(region => `
                <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                    <input type="checkbox" value="${region}" class="filter-checkbox">
                    <span>${region}</span>
                </label>
            `).join('');
        }

        // Populate Habitat filters
        if (habitatFilterOptions && filterData.habitats) {
            habitatFilterOptions.innerHTML = filterData.habitats.map(habitat => `
                <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                    <input type="checkbox" value="${habitat}" class="filter-checkbox">
                    <span>${habitat}</span>
                </label>
            `).join('');
        }

        // Populate Preparation Method filters
        if (preparationFilterOptions && filterData.preparation_methods) {
            preparationFilterOptions.innerHTML = filterData.preparation_methods.map(method => `
                <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                    <input type="checkbox" value="${method}" class="filter-checkbox">
                    <span>${method}</span>
                </label>
            `).join('');
        }

        // Populate Parts Used filters
        if (partsFilterOptions && filterData.parts_used) {
            partsFilterOptions.innerHTML = filterData.parts_used.map(part => `
                <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                    <input type="checkbox" value="${part}" class="filter-checkbox">
                    <span>${part}</span>
                </label>
            `).join('');
        }

        // Populate Medicinal Uses filters
        if (usesFilterOptions && filterData.medicinal_uses) {
            usesFilterOptions.innerHTML = filterData.medicinal_uses.map(use => `
                <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                    <input type="checkbox" value="${use}" class="filter-checkbox">
                    <span>${use}</span>
                </label>
            `).join('');
        }
    };

    // Call populate function on load
    populateFilterOptions();

    // Debounce function
    const debounce = (func, wait) => {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    };

    // Highlight Text Helper
    const highlightText = (text, query) => {
        if (!query || !text) return text;
        const regex = new RegExp(`(${query})`, 'gi');
        return text.replace(regex, '<span class="highlight">$1</span>');
    };

    // Fetch Suggestions (with loading + no results feedback)
    const fetchSuggestions = async (query) => {
        if (!query || query.length < 2) {
            searchSuggestions.style.display = 'none';
            suggestionIndex = -1;
            return;
        }

        suggestionsLoading = true;
        searchSuggestions.innerHTML = '<div class="suggestion-item disabled" style="justify-content:center;"><i class="fas fa-spinner fa-spin"></i> Loading...</div>';
        searchSuggestions.style.display = 'block';
        try {
            const response = await fetch(`/api/search-suggestions?q=${encodeURIComponent(query)}`);
            let suggestions = await response.json();
            currentSuggestions = suggestions;
            renderSuggestions(suggestions);
            suggestionsLoading = false;
        } catch (error) {
            currentSuggestions = [];
            searchSuggestions.innerHTML = '<div class="suggestion-item disabled" style="justify-content:center;">Error loading suggestions</div>';
            suggestionsLoading = false;
        }
    };

    // Render Suggestions (with no suggestions state)
    const renderSuggestions = (suggestions) => {
        if (suggestionsLoading) return;
        if (!suggestions.length) {
            searchSuggestions.innerHTML = '<div class="suggestion-item disabled" style="justify-content:center;">No suggestions found</div>';
            searchSuggestions.style.display = 'block';
            suggestionIndex = -1;
            return;
        }
        suggestionIndex = -1;
        searchSuggestions.innerHTML = suggestions.map((s, i) => `
            <div class="suggestion-item" data-value="${s.value}" data-id="${s.id}" tabindex="0">
                <i class="fas fa-leaf"></i>
                <span>${highlightText(s.value, searchInput.value)}</span>
            </div>
        `).join('');
        searchSuggestions.style.display = 'block';
        // Add click listeners
        searchSuggestions.querySelectorAll('.suggestion-item').forEach((item, i) => {
            item.addEventListener('click', () => {
                searchInput.value = item.dataset.value;
                searchSuggestions.style.display = 'none';
                performSearch(1);
            });
        });
    };

    // Keyboard navigation for suggestions
    if (searchInput) {
        searchInput.addEventListener('keydown', (e) => {
            if (!searchSuggestions || searchSuggestions.style.display === 'none') return;
            const items = Array.from(searchSuggestions.querySelectorAll('.suggestion-item:not(.disabled)'));
            if (items.length === 0) return;

            // Arrow Down
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                suggestionIndex = (suggestionIndex + 1) % items.length;
                items.forEach((item, idx) => {
                    item.classList.toggle('active', idx === suggestionIndex);
                });
                items[suggestionIndex].scrollIntoView({ block: 'nearest' });
            }
            // Arrow Up
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                suggestionIndex = (suggestionIndex - 1 + items.length) % items.length;
                items.forEach((item, idx) => {
                    item.classList.toggle('active', idx === suggestionIndex);
                });
                items[suggestionIndex].scrollIntoView({ block: 'nearest' });
            }
            // Enter
            if (e.key === 'Enter' && suggestionIndex >= 0 && suggestionIndex < items.length) {
                e.preventDefault();
                searchInput.value = items[suggestionIndex].dataset.value;
                searchSuggestions.style.display = 'none';
                performSearch(1);
            }
            // Escape
            if (e.key === "Escape") {
                suggestionIndex = -1;
                searchSuggestions.style.display = 'none';
            }
        });
    }

    // Hero Text Elements
    const heroTitle = document.querySelector('.hero-title');
    const heroSubtitle = document.querySelector('.hero-subtitle');
    const originalTitle = heroTitle ? heroTitle.innerHTML : '';
    const originalSubtitle = heroSubtitle ? heroSubtitle.innerHTML : '';

    // Update Hero Text Helper
    const updateHeroText = (state, data = {}) => {
        if (!heroTitle || !heroSubtitle) return;

        // Fade out
        heroTitle.style.opacity = '0';
        heroSubtitle.style.opacity = '0';

        setTimeout(() => {
            switch (state) {
                case 'searching':
                    heroTitle.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Searching...';
                    heroSubtitle.textContent = 'Looking through our collection of medicinal plants...';
                    break;
                case 'results':
                    heroTitle.innerHTML = `<i class="fas fa-check-circle"></i> Found ${data.count} Result${data.count !== 1 ? 's' : ''}`;
                    heroSubtitle.innerHTML = `Showing results for "<strong>${sanitize(data.query)}</strong>"`;
                    break;
                case 'no_results':
                    heroTitle.innerHTML = '<i class="fas fa-search-minus"></i> No Plants Found';
                    heroSubtitle.innerHTML = `We couldn't find any matches for "<strong>${sanitize(data.query)}</strong>". Try different keywords.`;
                    break;
                default:
                    heroTitle.innerHTML = originalTitle;
                    heroSubtitle.innerHTML = originalSubtitle;
            }

            // Fade in
            heroTitle.style.opacity = '1';
            heroSubtitle.style.opacity = '1';
        }, 200);
    };

    // Helper to sanitize string (simple version)
    const sanitize = (str) => str ? str.replace(/</g, "&lt;").replace(/>/g, "&gt;") : '';

    // Perform Search
    const performSearch = async (page = 1) => {
        if (!resultsGrid) return;

        const query = searchInput.value.trim();

        // Gather filters
        const selectedRegions = Array.from(regionFilterOptions?.querySelectorAll('input:checked') || []).map(c => c.value);
        const selectedHabitat = Array.from(habitatFilterOptions?.querySelectorAll('input:checked') || []).map(c => c.value);
        const selectedPreparation = Array.from(preparationFilterOptions?.querySelectorAll('input:checked') || []).map(c => c.value);
        const selectedParts = Array.from(partsFilterOptions?.querySelectorAll('input:checked') || []).map(c => c.value);
        const selectedUses = Array.from(usesFilterOptions?.querySelectorAll('input:checked') || []).map(c => c.value);
        const safePregnancy = safePregnancyFilter?.checked || false;
        const noInteractions = noInteractionsFilter?.checked || false;
        const hasImage = hasImageFilter?.checked || false;

        const hasActiveFilters = selectedRegions.length > 0 || selectedHabitat.length > 0 || selectedPreparation.length > 0 ||
            selectedParts.length > 0 || selectedUses.length > 0 || safePregnancy || noInteractions || hasImage;

        // If no query and no filters, show empty state
        if (!query && !hasActiveFilters) {
            resultsGrid.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-search"></i>
                    <p>Type a plant name or medical use to begin exploring our comprehensive database</p>
                </div>
            `;
            if (resultsInfo) resultsInfo.innerHTML = '<i class="fas fa-info-circle"></i> Start searching to see results';
            if (paginationContainer) paginationContainer.innerHTML = '';
            updateHeroText('default');
            return;
        }

        // Update loading state
        resultsGrid.innerHTML = `
            <div class="loading-state">
                <i class="fas fa-circle-notch fa-spin"></i>
                <p>Searching database...</p>
            </div>
        `;

        // Update Hero Text to Searching
        if (query) {
            updateHeroText('searching');
        } else {
            updateHeroText('default');
        }

        const filters = {
            region: selectedRegions,
            habitat: selectedHabitat,
            preparation_method: selectedPreparation,
            parts_used: selectedParts,
            medicinal_uses: selectedUses
        };
        if (safePregnancy) filters.safe_pregnancy = true;
        if (noInteractions) filters.no_interactions = true;
        if (hasImage) filters.has_image = true;

        const payload = {
            query: query,
            filters: filters,
            sort: sortFilter.value,
            page: page,
            per_page: 12
        };

        try {
            const response = await fetch('/api/search-plants', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) throw new Error('Search failed');

            const data = await response.json();
            renderResults(data, payload.query);
            updateActiveFilters(filters);
            updateUrl(payload);

            // Update Hero Text based on results
            if (query) {
                if (data.total > 0) {
                    updateHeroText('results', { count: data.total, query: query });
                } else {
                    updateHeroText('no_results', { query: query });
                }
            } else {
                updateHeroText('default');
            }

        } catch (error) {
            console.error('Search error:', error);
            resultsGrid.innerHTML = `
                <div class="loading-state">
                    <i class="fas fa-exclamation-circle" style="color: var(--danger);"></i>
                    <p>Error loading results. Please try again.</p>
                </div>
            `;
            updateHeroText('default');
        }
    };

    // Render Results
    const renderResults = (data, query) => {
        // Store current plant data
        currentPlantsData = data.plants;

        // Update Count
        if (resultsInfo) {
            resultsInfo.innerHTML = `Found <strong>${data.total}</strong> plants`;
        }

        // Update Grid
        if (data.plants.length === 0) {
            resultsGrid.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-search"></i>
                    <p>No plants found matching your criteria.</p>
                </div>
            `;
            if (paginationContainer) paginationContainer.innerHTML = '';
            return;
        }

        resultsGrid.innerHTML = data.plants.map((plant, index) => {
            // Helper to create detail row
            const createDetailRow = (icon, label, value) => {
                if (!value) return '';
                return `
                    <div class="info">
                        <span class="label"><i class="fas fa-${icon}" aria-hidden="true"></i> ${label}:</span> 
                        <span>${highlightText(sanitize(value), query)}</span>
                    </div>
                `;
            };

            // Display precautions warning
            const precautionsWarning = window.displayPrecautionsWarning ? window.displayPrecautionsWarning(plant.precautions) : '';

            return `
            <article class="plant-card" style="animation-delay: ${index * 50}ms; position: relative;">
                <!-- Expand Button -->
                <button class="expand-btn" data-plant-id="${plant.id}" title="View full details">
                    <i class="fas fa-expand"></i>
                </button>
                
                <!-- Comparison Checkbox -->
                <input type="checkbox" class="comparison-checkbox" data-plant-id="${plant.id}" 
                    style="position: absolute; top: 10px; right: 10px; width: 20px; height: 20px; cursor: pointer; z-index: 10;"
                    ${comparisonCart.includes(plant.id) ? 'checked' : ''}>
                
                <div class="plant-image-container">
                    <img class="plant-image" 
                         src="${plant.image_url || '/static/images/default_plant.jpg'}" 
                         alt="${sanitize(plant.common_name)}"
                         loading="lazy"
                         onerror="this.src='/static/images/default_plant.jpg'; this.classList.add('error');">
                </div>
                <div class="card-content">
                    <h3 class="plant-name"><i class="fas fa-leaf" aria-hidden="true"></i> ${highlightText(sanitize(plant.common_name), query)}</h3>
                    <div class="sci-name"><i class="fas fa-flask" aria-hidden="true"></i> ${highlightText(sanitize(plant.scientific_name), query)}</div>
                    
                    <div class="plant-details">
                        ${createDetailRow('capsules', 'Uses', plant.medicinal_uses)}
                        ${createDetailRow('leaf', 'Parts Used', plant.parts_used)}
                        ${createDetailRow('mortar-pestle', 'Preparation', plant.preparation_method)}
                        ${createDetailRow('globe-asia', 'Habitat', plant.habitat)}
                        ${createDetailRow('globe', 'Region', plant.region)}
                        ${createDetailRow('info-circle', 'Description', plant.description)}
                    </div>
                    
                    <!-- Precautions Warning -->
                    ${precautionsWarning}
                </div>
            </article>
            `;
        }).join('');

        // Add expand button listeners
        resultsGrid.querySelectorAll('.expand-btn').forEach((btn, index) => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const card = btn.closest('.plant-card');
                const plantId = btn.dataset.plantId;
                const plant = data.plants.find(p => p.id == plantId);
                if (plant) {
                    toggleExpandCard(card, plant, index, data.plants);
                }
            });
        });

        // Add click listeners to cards to navigate to details
        resultsGrid.querySelectorAll('.plant-card').forEach((card, index) => {
            const plant = data.plants[index];
            card.addEventListener('click', (e) => {
                if (e.target.classList.contains('comparison-checkbox') ||
                    e.target.closest('.expand-btn') ||
                    card.classList.contains('expanded')) {
                    e.stopPropagation();
                    return;
                }
                window.location.href = `/plants-page?plant=${plant.id}`;
            });

            // Trigger animation
            requestAnimationFrame(() => card.classList.add('fade-in'));
        });

        // Add comparison checkbox listeners
        resultsGrid.querySelectorAll('.comparison-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                e.stopPropagation();
                if (e.target.checked) {
                    window.addToComparison(e.target.dataset.plantId);
                } else {
                    window.removeFromComparison(e.target.dataset.plantId);
                }
            });
        });

        // Update Pagination
        renderPagination(data.pagination);
    };

    // Toggle Expand Card Function
    const toggleExpandCard = (card, plant, index = null, allPlants = null) => {
        const isExpanded = card.classList.contains('expanded');

        if (isExpanded) {
            // Collapse
            collapseCard(card);
        } else {
            // Collapse any other expanded cards
            document.querySelectorAll('.results-grid .plant-card.expanded').forEach(c => {
                if (c !== card) collapseCard(c);
            });

            // Expand this card
            expandCard(card, plant, index, allPlants);
        }
    };

    const expandCard = (card, plant, index = null, allPlants = null) => {
        card.classList.add('expanded');

        // Update expand button icon
        const btn = card.querySelector('.expand-btn');
        if (btn) {
            btn.innerHTML = '<i class="fas fa-compress"></i>';
            btn.title = 'Close details';
        }

        // Reconstruct card with full details
        const createDetailRow = (icon, label, value) => {
            if (!value) return '';
            return `
                <div class="info">
                    <span class="label"><i class="fas fa-${icon}" aria-hidden="true"></i> ${label}:</span> 
                    <span>${sanitize(value)}</span>
                </div>
            `;
        };

        const precautionsWarning = window.displayPrecautionsWarning ? window.displayPrecautionsWarning(plant.precautions) : '';

        card.innerHTML = `
            <!-- Expand Button -->
            <button class="expand-btn" title="Close details">
                <i class="fas fa-compress"></i>
            </button>
            
            <!-- Comparison Checkbox -->
            <input type="checkbox" class="comparison-checkbox" data-plant-id="${plant.id}" 
                style="position: absolute; top: 10px; right: 10px; width: 20px; height: 20px; cursor: pointer; z-index: 10;"
                ${comparisonCart.includes(plant.id.toString()) ? 'checked' : ''}>
            
            <div class="plant-image-container">
                <img class="plant-image" 
                     src="${plant.image_url || '/static/images/default_plant.jpg'}" 
                     alt="${sanitize(plant.common_name)}"
                     loading="eager"
                     onerror="this.src='/static/images/default_plant.jpg';">
            </div>
            
            <div class="card-content">
                <h3 class="plant-name"><i class="fas fa-leaf" aria-hidden="true"></i> ${sanitize(plant.common_name)}</h3>
                <div class="sci-name"><i class="fas fa-flask" aria-hidden="true"></i> ${sanitize(plant.scientific_name)}</div>
                
                <div class="plant-details">
                    ${createDetailRow('capsules', 'Medicinal Uses', plant.medicinal_uses)}
                    ${createDetailRow('leaf', 'Parts Used', plant.parts_used)}
                    ${createDetailRow('mortar-pestle', 'Preparation Method', plant.preparation_method)}
                    ${createDetailRow('globe-asia', 'Habitat', plant.habitat)}
                    ${createDetailRow('globe', 'Region', plant.region)}
                    ${createDetailRow('tree', 'Family', plant.family || 'N/A')}
                    ${createDetailRow('droplet', 'Growing Conditions', plant.growing_conditions || 'N/A')}
                    ${createDetailRow('info-circle', 'Description', plant.description)}
                </div>
                
                <!-- Precautions Warning -->
                ${precautionsWarning}
            </div>
        `;

        // Re-attach event listeners
        card.querySelector('.expand-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            collapseCard(card);
        });

        card.querySelector('.comparison-checkbox').addEventListener('change', (e) => {
            e.stopPropagation();
            if (e.target.checked) {
                window.addToComparison(e.target.dataset.plantId);
            } else {
                window.removeFromComparison(e.target.dataset.plantId);
            }
        });
    };

    const collapseCard = (card) => {
        const plantId = card.querySelector('.comparison-checkbox').dataset.plantId;
        const plant = currentPlantsData.find(p => p.id == plantId);

        if (plant) {
            card.classList.remove('expanded');

            // Reconstruct as normal card
            const createDetailRow = (icon, label, value) => {
                if (!value) return '';
                return `
                    <div class="info">
                        <span class="label"><i class="fas fa-${icon}" aria-hidden="true"></i> ${label}:</span> 
                        <span>${sanitize(value)}</span>
                    </div>
                `;
            };

            const precautionsWarning = window.displayPrecautionsWarning ? window.displayPrecautionsWarning(plant.precautions) : '';

            card.innerHTML = `
                <!-- Expand Button -->
                <button class="expand-btn" data-plant-id="${plant.id}" title="View full details">
                    <i class="fas fa-expand"></i>
                </button>
                
                <!-- Comparison Checkbox -->
                <input type="checkbox" class="comparison-checkbox" data-plant-id="${plant.id}" 
                    style="position: absolute; top: 10px; right: 10px; width: 20px; height: 20px; cursor: pointer; z-index: 10;"
                    ${comparisonCart.includes(plant.id.toString()) ? 'checked' : ''}>
                
                <div class="plant-image-container">
                    <img class="plant-image" 
                         src="${plant.image_url || '/static/images/default_plant.jpg'}" 
                         alt="${sanitize(plant.common_name)}"
                         loading="lazy"
                         onerror="this.src='/static/images/default_plant.jpg'; this.classList.add('error');">
                </div>
                <div class="card-content">
                    <h3 class="plant-name"><i class="fas fa-leaf" aria-hidden="true"></i> ${sanitize(plant.common_name)}</h3>
                    <div class="sci-name"><i class="fas fa-flask" aria-hidden="true"></i> ${sanitize(plant.scientific_name)}</div>
                    
                    <div class="plant-details">
                        ${createDetailRow('capsules', 'Uses', plant.medicinal_uses)}
                        ${createDetailRow('leaf', 'Parts Used', plant.parts_used)}
                        ${createDetailRow('mortar-pestle', 'Preparation', plant.preparation_method)}
                        ${createDetailRow('globe-asia', 'Habitat', plant.habitat)}
                        ${createDetailRow('globe', 'Region', plant.region)}
                        ${createDetailRow('info-circle', 'Description', plant.description)}
                    </div>
                    
                    <!-- Precautions Warning -->
                    ${precautionsWarning}
                </div>
            `;

            // Re-attach event listeners
            card.querySelector('.expand-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                toggleExpandCard(card, plant);
            });

            card.querySelector('.comparison-checkbox').addEventListener('change', (e) => {
                e.stopPropagation();
                if (e.target.checked) {
                    window.addToComparison(e.target.dataset.plantId);
                } else {
                    window.removeFromComparison(e.target.dataset.plantId);
                }
            });

            card.addEventListener('click', (e) => {
                if (!e.target.classList.contains('comparison-checkbox') &&
                    !e.target.closest('.expand-btn')) {
                    window.location.href = `/plants-page?plant=${plant.id}`;
                }
            });
        }
    };

    // Render Pagination
    const renderPagination = (pagination) => {
        if (!paginationContainer || pagination.total_pages <= 1) {
            paginationContainer.innerHTML = '';
            return;
        }

        let html = '<nav class="pagination">';

        // Prev
        if (pagination.has_prev) {
            html += `<a href="#" class="page-link" data-page="${pagination.current_page - 1}"><i class="fas fa-chevron-left"></i></a>`;
        }

        // Pages
        for (let i = 1; i <= pagination.total_pages; i++) {
            // Show first, last, current, and surrounding pages
            if (i === 1 || i === pagination.total_pages || (i >= pagination.current_page - 1 && i <= pagination.current_page + 1)) {
                html += `<a href="#" class="page-link ${i === pagination.current_page ? 'active' : ''}" data-page="${i}">${i}</a>`;
            } else if (i === pagination.current_page - 2 || i === pagination.current_page + 2) {
                html += `<span class="page-link" style="border:none; background:none;">...</span>`;
            }
        }

        // Next
        if (pagination.has_next) {
            html += `<a href="#" class="page-link" data-page="${pagination.current_page + 1}"><i class="fas fa-chevron-right"></i></a>`;
        }

        html += '</nav>';
        paginationContainer.innerHTML = html;

        // Add event listeners
        paginationContainer.querySelectorAll('.page-link[data-page]').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const page = parseInt(e.currentTarget.dataset.page);
                performSearch(page);
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
        });
    };

    // Update Active Filters UI
    const updateActiveFilters = (filters) => {
        if (!activeFiltersContainer) return;

        let html = '';

        if (filters.region) {
            filters.region.forEach(r => {
                html += `<span class="filter-pill">${r} <button class="remove-filter" data-type="region" data-value="${r}">&times;</button></span>`;
            });
        }

        if (filters.habitat) {
            filters.habitat.forEach(h => {
                html += `<span class="filter-pill">${h} <button class="remove-filter" data-type="habitat" data-value="${h}">&times;</button></span>`;
            });
        }

        if (filters.preparation_method) {
            filters.preparation_method.forEach(p => {
                html += `<span class="filter-pill">${p} <button class="remove-filter" data-type="preparation" data-value="${p}">&times;</button></span>`;
            });
        }

        if (filters.parts_used) {
            filters.parts_used.forEach(p => {
                html += `<span class="filter-pill">${p} <button class="remove-filter" data-type="parts" data-value="${p}">&times;</button></span>`;
            });
        }

        if (filters.medicinal_uses) {
            filters.medicinal_uses.forEach(u => {
                html += `<span class="filter-pill">${u} <button class="remove-filter" data-type="uses" data-value="${u}">&times;</button></span>`;
            });
        }

        if (filters.safe_pregnancy) {
            html += `<span class="filter-pill"><i class="fas fa-female"></i> Safe in Pregnancy <button class="remove-filter" data-type="pregnancy">&times;</button></span>`;
        }

        if (filters.no_interactions) {
            html += `<span class="filter-pill"><i class="fas fa-pills"></i> No Drug Interactions <button class="remove-filter" data-type="interactions">&times;</button></span>`;
        }

        if (filters.has_image) {
            html += `<span class="filter-pill">Has Image <button class="remove-filter" data-type="image">&times;</button></span>`;
        }

        activeFiltersContainer.innerHTML = html;

        // Add remove listeners
        activeFiltersContainer.querySelectorAll('.remove-filter').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const type = e.target.dataset.type;
                const value = e.target.dataset.value;

                if (type === 'region') {
                    const cb = regionFilterOptions.querySelector(`input[value="${value}"]`);
                    if (cb) cb.checked = false;
                } else if (type === 'habitat') {
                    const cb = habitatFilterOptions.querySelector(`input[value="${value}"]`);
                    if (cb) cb.checked = false;
                } else if (type === 'preparation') {
                    const cb = preparationFilterOptions.querySelector(`input[value="${value}"]`);
                    if (cb) cb.checked = false;
                } else if (type === 'parts') {
                    const cb = partsFilterOptions.querySelector(`input[value="${value}"]`);
                    if (cb) cb.checked = false;
                } else if (type === 'uses') {
                    const cb = usesFilterOptions.querySelector(`input[value="${value}"]`);
                    if (cb) cb.checked = false;
                } else if (type === 'pregnancy') {
                    if (safePregnancyFilter) safePregnancyFilter.checked = false;
                } else if (type === 'interactions') {
                    if (noInteractionsFilter) noInteractionsFilter.checked = false;
                } else if (type === 'image') {
                    if (hasImageFilter) hasImageFilter.checked = false;
                }

                performSearch(1);
            });
        });
    };

    // Update URL without reload
    const updateUrl = (payload) => {
        const url = new URL(window.location);
        url.searchParams.set('q', payload.query);

        if (payload.filters.region && payload.filters.region.length)
            url.searchParams.set('region', payload.filters.region.join(','));
        else
            url.searchParams.delete('region');

        if (payload.filters.habitat && payload.filters.habitat.length)
            url.searchParams.set('habitat', payload.filters.habitat.join(','));
        else
            url.searchParams.delete('habitat');

        if (payload.filters.preparation_method && payload.filters.preparation_method.length)
            url.searchParams.set('prep', payload.filters.preparation_method.join(','));
        else
            url.searchParams.delete('prep');

        if (payload.filters.parts_used && payload.filters.parts_used.length)
            url.searchParams.set('parts', payload.filters.parts_used.join(','));
        else
            url.searchParams.delete('parts');

        if (payload.filters.medicinal_uses && payload.filters.medicinal_uses.length)
            url.searchParams.set('uses', payload.filters.medicinal_uses.join(','));
        else
            url.searchParams.delete('uses');

        if (payload.filters.safe_pregnancy)
            url.searchParams.set('safe_pregnancy', '1');
        else
            url.searchParams.delete('safe_pregnancy');

        if (payload.filters.no_interactions)
            url.searchParams.set('no_interactions', '1');
        else
            url.searchParams.delete('no_interactions');

        if (payload.filters.has_image)
            url.searchParams.set('has_image', '1');
        else
            url.searchParams.delete('has_image');

        window.history.pushState({}, '', url);
    };

    // Event Listeners
    if (searchForm) {
        searchForm.addEventListener('submit', (e) => {
            e.preventDefault();
            searchSuggestions.style.display = 'none';
            performSearch(1);
        });
    }

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value;
            debounce(() => {
                performSearch(1);
                fetchSuggestions(query);
            }, 300)();
        });

        // Hide suggestions on click outside
        document.addEventListener('click', (e) => {
            if (!searchForm.contains(e.target)) {
                searchSuggestions.style.display = 'none';
            }
        });
    }

    if (sortFilter) {
        sortFilter.addEventListener('change', () => performSearch(1));
    }

    // Filter checkboxes - Updated selector to include all filter types
    const filterInputs = document.querySelectorAll('.filter-options input, #safePregnancyFilter, #noInteractionsFilter, #hasImageFilter');
    filterInputs.forEach(input => {
        input.addEventListener('change', () => performSearch(1));
    });

    // Clear filters
    const clearFiltersBtn = document.getElementById('clearFilters');
    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', () => {
            filterInputs.forEach(input => input.checked = false);
            performSearch(1);
        });
    }

    // Initial Search if query exists or just load all
    performSearch(1);

    // Initialize advanced features
    function initializeAdvancedFeatures() {
        // Update comparison panel on load
        updateComparisonPanel();

        // Setup comparison modal close button
        const closeComparisonBtn = document.getElementById('closeComparisonModal');
        const comparisonModal = document.getElementById('comparisonModal');
        if (closeComparisonBtn) {
            closeComparisonBtn.addEventListener('click', () => {
                comparisonModal.style.display = 'none';
            });
        }

        // Close modal on background click
        if (comparisonModal) {
            comparisonModal.addEventListener('click', (e) => {
                if (e.target === comparisonModal) {
                    comparisonModal.style.display = 'none';
                }
            });
        }

        // Setup comparison buttons if advanced features loaded
        const viewComparisonBtn = document.getElementById('viewComparisonBtn');
        const clearComparisonBtn = document.getElementById('clearComparisonBtn');

        if (viewComparisonBtn) {
            viewComparisonBtn.addEventListener('click', () => {
                viewComparison();
            });
        }

        if (clearComparisonBtn) {
            clearComparisonBtn.addEventListener('click', () => {
                comparisonCart = [];
                localStorage.removeItem('plantComparison');
                updateComparisonPanel();
                alert('Comparison cart cleared');
            });
        }
    }

    // Make functions available globally for use with window object
    window.addToComparison = addToComparison;
    window.removeFromComparison = removeFromComparison;
    window.updateComparisonPanel = updateComparisonPanel;
    window.viewComparison = viewComparison;
    window.renderComparisonTable = renderComparisonTable;
    window.displayPrecautionsWarning = displayPrecautionsWarning;

    // Comparison Functions
    function updateComparisonPanel() {
        const panel = document.getElementById('comparisonPanel');
        const count = document.getElementById('comparisonCount');

        if (comparisonCart.length === 0) {
            if (panel) panel.style.display = 'none';
        } else {
            if (panel) panel.style.display = 'block';
            if (count) count.textContent = comparisonCart.length;
        }
    }

    function addToComparison(plantId) {
        if (!comparisonCart.includes(plantId)) {
            if (comparisonCart.length < 5) {
                comparisonCart.push(plantId);
                localStorage.setItem('plantComparison', JSON.stringify(comparisonCart));
                updateComparisonPanel();
            } else {
                alert('You can compare up to 5 plants at a time');
            }
        }
    }

    function removeFromComparison(plantId) {
        comparisonCart = comparisonCart.filter(id => id !== plantId);
        localStorage.setItem('plantComparison', JSON.stringify(comparisonCart));
        updateComparisonPanel();
    }

    async function viewComparison() {
        if (comparisonCart.length === 0) {
            alert('Please select plants to compare');
            return;
        }

        try {
            const response = await fetch('/api/compare-plants', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ plant_ids: comparisonCart })
            });

            const data = await response.json();
            renderComparisonTable(data.plants);
            document.getElementById('comparisonModal').style.display = 'block';
        } catch (error) {
            console.error('Comparison error:', error);
            alert('Error loading comparison');
        }
    }

    function renderComparisonTable(plants) {
        const tableContainer = document.getElementById('comparisonTableContainer');
        if (!plants || plants.length === 0 || !tableContainer) return;

        const fields = [
            { key: 'common_name', label: 'Common Name', icon: 'fa-leaf' },
            { key: 'scientific_name', label: 'Scientific Name', icon: 'fa-flask' },
            { key: 'medicinal_uses', label: 'Medicinal Uses', icon: 'fa-capsules' },
            { key: 'preparation_method', label: 'Preparation Method', icon: 'fa-mortar-pestle' },
            { key: 'parts_used', label: 'Parts Used', icon: 'fa-leaf' },
            { key: 'precautions', label: 'Precautions', icon: 'fa-exclamation-triangle' },
            { key: 'habitat', label: 'Habitat', icon: 'fa-tree' },
            { key: 'region', label: 'Region', icon: 'fa-globe' }
        ];

        let html = '<table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">';

        // Header row
        html += '<tr style="background: var(--primary); color: white; position: sticky; top: 0;">';
        html += '<th style="padding: 1rem; text-align: left; border: 1px solid #ddd; min-width: 150px;"><i class="fas fa-list"></i> Property</th>';
        plants.forEach(plant => {
            html += `<th style="padding: 1rem; text-align: left; border: 1px solid #ddd; min-width: 200px;"><strong>${plant.common_name}</strong></th>`;
        });
        html += '</tr>';

        // Data rows
        fields.forEach((field, idx) => {
            const bgColor = idx % 2 === 0 ? 'rgba(0,0,0,0.02)' : 'white';
            html += `<tr style="background: ${bgColor};">`;
            html += `<td style="padding: 1rem; border: 1px solid #ddd; font-weight: 600;"><i class="fas ${field.icon}"></i> ${field.label}</td>`;
            plants.forEach(plant => {
                const value = plant[field.key] || 'N/A';
                html += `<td style="padding: 1rem; border: 1px solid #ddd;">${value}</td>`;
            });
            html += '</tr>';
        });

        html += '</table>';
        tableContainer.innerHTML = html;
    }

    function displayPrecautionsWarning(precautions) {
        if (!precautions || precautions.trim() === '') return '';

        const warningKeywords = [
            'avoid', 'do not', 'contraindicated', 'allergic', 'toxic',
            'overdose', 'interact', 'pregnancy', 'lactation', 'breast', 'liver', 'kidney'
        ];

        const hasCriticalWarning = warningKeywords.some(keyword =>
            precautions.toLowerCase().includes(keyword)
        );

        const icon = hasCriticalWarning ? 'fa-exclamation-circle' : 'fa-info-circle';
        const bgColor = hasCriticalWarning ? 'rgba(239, 68, 68, 0.1)' : 'rgba(59, 130, 246, 0.1)';
        const borderColor = hasCriticalWarning ? '#ef4444' : '#3b82f6';
        const textColor = hasCriticalWarning ? '#991b1b' : '#1e40af';

        return `
            <div style="margin-top: 0.75rem; padding: 0.75rem; background: ${bgColor}; 
                border-left: 3px solid ${borderColor}; border-radius: 4px; color: ${textColor}; font-size: 0.9rem;">
                <i class="fas ${icon}"></i> <strong>⚠️ ${hasCriticalWarning ? 'IMPORTANT' : 'Note'}:</strong> ${precautions}
            </div>
        `;
    }
});
