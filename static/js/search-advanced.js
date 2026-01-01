// Advanced Search Features Module

// ===== ADVANCED SEARCH FEATURES =====

// Symptom/Condition Mapping
const symptomMap = {
    'Sleep Issues': ['sleep', 'insomnia', 'anxiety', 'relaxation'],
    'Inflammation': ['inflammation', 'pain', 'arthritis', 'joint'],
    'Immune Boost': ['immune', 'antiviral', 'antibacterial', 'infection'],
    'Digestion': ['digestion', 'stomach', 'nausea', 'gastric', 'diarrhea'],
    'Anxiety': ['anxiety', 'stress', 'calming', 'nervous', 'mood'],
    'Energy': ['energy', 'stamina', 'fatigue', 'vitality', 'vigor'],
    'Skin Health': ['skin', 'wound', 'eczema', 'dermatitis', 'rash'],
    'Cold & Flu': ['cold', 'flu', 'cough', 'respiratory', 'throat'],
    'Women\'s Health': ['menstrual', 'menopause', 'hormone', 'fertility'],
    'Heart Health': ['heart', 'blood pressure', 'circulation', 'cardiovascular']
};

// Boolean Search Parser (AND, OR, NOT)
function parseAdvancedSearch(query) {
    // Convert natural AND/OR/NOT operators into filter logic
    let includeTerms = [];
    let excludeTerms = [];
    let orTerms = [];
    
    // Split by AND
    const andSegments = query.split(/\s+AND\s+/i);
    
    andSegments.forEach(segment => {
        // Check for NOT
        if (segment.includes(' NOT ')) {
            const [positive, negative] = segment.split(/\s+NOT\s+/i);
            if (positive.trim()) includeTerms.push(positive.trim().toLowerCase());
            if (negative.trim()) excludeTerms.push(negative.trim().toLowerCase());
        } else if (segment.includes(' OR ')) {
            // Handle OR groups
            const orOptions = segment.split(/\s+OR\s+/i).map(t => t.trim().toLowerCase());
            orTerms.push(orOptions);
        } else {
            if (segment.trim()) includeTerms.push(segment.trim().toLowerCase());
        }
    });
    
    return { includeTerms, excludeTerms, orTerms };
}

// Apply Boolean Search Logic
function applyAdvancedSearch(plants, query) {
    if (!query) return plants;
    
    const { includeTerms, excludeTerms, orTerms } = parseAdvancedSearch(query);
    
    return plants.filter(plant => {
        const plantText = (
            (plant.common_name || '') + ' ' + 
            (plant.scientific_name || '') + ' ' + 
            (plant.medicinal_uses || '') + ' ' + 
            (plant.precautions || '') + ' ' +
            (plant.habitat || '') + ' ' +
            (plant.parts_used || '')
        ).toLowerCase();
        
        // All AND terms must exist
        const hasAllRequired = includeTerms.every(term => plantText.includes(term));
        
        // No NOT terms should exist
        const hasNoExcluded = excludeTerms.every(term => !plantText.includes(term));
        
        // At least one OR term should exist (if any)
        const hasAtLeastOneOR = orTerms.length === 0 || orTerms.some(orGroup => 
            orGroup.some(term => plantText.includes(term))
        );
        
        return hasAllRequired && hasNoExcluded && hasAtLeastOneOR;
    });
}

// ===== PLANT COMPARISON FEATURE =====

// Note: comparisonCart is declared in search.js and should not be redeclared here
// to avoid overwriting the shared variable

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
    const table = document.getElementById('comparisonTable');
    if (!plants || plants.length === 0) return;
    
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
    table.innerHTML = html;
}

// ===== PRECAUTIONS WARNING SYSTEM =====

function displayPrecautionsWarning(precautions) {
    if (!precautions || precautions.trim() === '') return '';
    
    const warningKeywords = [
        'avoid', 'do not', 'contraindicated', 'allergic', 'toxic', 
        'overdose', 'interact', 'pregnancy', 'lactation', 'breast', 'liver', 'kidney'
    ];
    
    const hasCriticalWarning = warningKeywords.some(keyword => 
        precautions.toLowerCase().includes(keyword)
    );
    
    const warningLevel = hasCriticalWarning ? 'high' : 'medium';
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

// ===== SYMPTOM FILTER INITIALIZATION =====

function populateSymptomFilter() {
    const symptomFilter = document.getElementById('symptomFilter');
    if (!symptomFilter) return;
    
    symptomFilter.innerHTML = Object.keys(symptomMap).map(symptom => `
        <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
            <input type="checkbox" class="symptom-checkbox" data-symptom="${symptom}" style="width: 18px; height: 18px; cursor: pointer;">
            <span>${symptom}</span>
        </label>
    `).join('');
    
    // Add click handlers
    symptomFilter.querySelectorAll('.symptom-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            const symptom = checkbox.dataset.symptom;
            const searchInput = document.getElementById('heroSearch');
            if (searchInput && checkbox.checked) {
                searchInput.value = symptomMap[symptom].join(' OR ');
                searchInput.dispatchEvent(new Event('input', { bubbles: true }));
            }
        });
    });
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    populateSymptomFilter();
    
    // Clear comparison button
    const clearComparisonBtn = document.getElementById('clearComparisonBtn');
    if (clearComparisonBtn) {
        clearComparisonBtn.addEventListener('click', () => {
            comparisonCart = [];
            localStorage.removeItem('plantComparison');
            updateComparisonPanel();
            alert('Comparison cart cleared');
        });
    }
    
    // View comparison button
    const viewComparisonBtn = document.getElementById('viewComparisonBtn');
    if (viewComparisonBtn) {
        viewComparisonBtn.addEventListener('click', viewComparison);
    }
    
    // Close comparison modal on background click
    const modal = document.getElementById('comparisonModal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });
    }
});
