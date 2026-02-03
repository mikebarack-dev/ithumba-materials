

// category.js (Minor fix for category parsing)

import { createProductCard } from "./utils.js"; 

// --- 2. DOM Elements ---
const categoryTitle = document.getElementById('category-title');
const productsContainer = document.getElementById('category-products');


// --- 3. CORE LOGIC ---

/**
 * Maps the file name to the expected Firestore category name.
 * IMPORTANT: This mapping must match the strings used in your Firestore 'category' field.
 */
function mapFilenameToCategory(filename) {
    const map = {
        'structural': 'Structural Materials',
        'plumbing': 'Plumbing',
        'fencing-roofing': 'Fencing & Roofing',
        'paints': 'Paints & Chemicals',
        'paints-new': 'Paints & Chemicals',
        'tools': 'Tools & Hardware',
        'brushes': 'Brushes & Applicators'
    };
    
    const baseName = filename.replace('.html', '').split('?')[0];
    const categoryKey = baseName.toLowerCase();
    
    return map[categoryKey] || 'All Products';
}


/**
 * Fetches products specific to this category from the API and renders them.
 */
async function fetchCategoryItems() {
    const pathParts = window.location.pathname.split('/');
    const categoryFile = pathParts[pathParts.length - 1];
    
    const categoryNameFirestore = mapFilenameToCategory(categoryFile);
    
    // Set the visible title
    categoryTitle.textContent = categoryNameFirestore;
    
    productsContainer.innerHTML = '<p class="loading-message">Loading products...</p>';

    try {
        // Use the exact Firestore string in the query parameter
        const response = await fetch(`/api/products?category=${encodeURIComponent(categoryNameFirestore)}`);
        
        if (!response.ok) {
            throw new Error(`Failed to fetch category products. Status: ${response.status}`);
        }

        const data = await response.json();

        productsContainer.innerHTML = ''; 

        if (data.length === 0) {
            productsContainer.innerHTML = '<p class="feedback-message">No products found in this category.</p>';
            return;
        }

        data.forEach(item => {
            productsContainer.appendChild(createProductCard(item));
        });

    } catch (error) {
        console.error('Error fetching category items:', error);
        productsContainer.innerHTML = '<p class="error-message">Error loading products. Check server connection.</p>';
    }
}


// --- 4. APP START ---
window.addEventListener('DOMContentLoaded', fetchCategoryItems);
