const apiKey = "AIzaSyCXsIZ0bvZ79cLjFnySx0Xwu-xHAoLso7g";
const defaultSettings = {
  distance: 0.5,       // Default search radius in miles
  price: "2,3",        // Google Places API uses 1-4 ($ - $$$$)
  dietary: "",         // Empty means no filter (future: vegetarian, gluten-free, etc.)
};

// Global variable to store restaurant details
let restaurantDetails = {};

// Convert miles to meters (Google Maps API uses meters)
function milesToMeters(miles) {
  return miles * 1609.34;
}

// Load user settings or use defaults
async function loadSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(defaultSettings, (settings) => {
      resolve(settings);
    });
  });
}

// Function to save restaurant to history
function saveToHistory(restaurant) {
  // Get current date and time
  const date = new Date();
  const formattedDate = date.toLocaleDateString();
  const formattedTime = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  
  // Create history entry
  const historyEntry = {
    name: restaurant.name,
    date: formattedDate,
    time: formattedTime,
    googleMapsLink: restaurant.googleMapsLink
  };
  
  // Get existing history from storage or initialize empty array
  chrome.storage.sync.get(['restaurantHistory'], (result) => {
    let history = result.restaurantHistory || [];
    
    // Add new entry at the beginning of the array
    history.unshift(historyEntry);
    
    // Limit history to 20 entries to prevent excessive storage usage
    if (history.length > 20) {
      history = history.slice(0, 20);
    }
    
    // Save updated history back to storage
    chrome.storage.sync.set({ restaurantHistory: history });
    
    console.log("✅ Restaurant saved to history:", historyEntry);
  });
}

async function fetchRestaurants() {
    try {
      // 🔄 Show Loading GIF and Hide the Wheel
      document.getElementById("loading-gif").style.display = "block";
      document.getElementById("wheel").style.display = "none";
  
      navigator.geolocation.getCurrentPosition(async (position) => {
        const { latitude: lat, longitude: lng } = position.coords;
        const settings = await loadSettings();
  
        const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${milesToMeters(settings.distance)}&type=restaurant&keyword=healthy&minprice=${settings.price[0]}&maxprice=${settings.price[2]}&key=${apiKey}`;
  
        const response = await fetch(url);
        const data = await response.json();
  
        if (!data.results || data.results.length === 0) {
          console.error("❌ No restaurants found!");
          alert("No restaurants found! Try adjusting your settings.");
          return;
        }
  
        // ✅ Extract restaurant data
        let restaurants = data.results.map((place) => ({
          name: place.name,
          distance: (settings.distance).toFixed(1),
          price: place.price_level ? "$".repeat(place.price_level) : "Unknown",
          lat: place.geometry.location.lat,
          lng: place.geometry.location.lng,
          placeId: place.place_id,
          googleMapsLink: `https://www.google.com/maps/place/?q=place_id:${place.place_id}`, // Add Google Maps link
        }));
  
        // ✅ Remove duplicate restaurant names
        const seen = new Set();
        restaurants = restaurants.filter((restaurant) => {
          if (seen.has(restaurant.name)) {
            return false; // Duplicate found, skip this restaurant
          }
          seen.add(restaurant.name);
          return true; // Unique restaurant, keep it
        });
  
        console.log("✅ Unique Restaurants fetched:", restaurants);
  
        // ✅ Store restaurant details globally
        restaurantDetails = restaurants.reduce((acc, r) => {
          acc[r.name] = r;
          return acc;
        }, {});
  
        // ⏳ Wait 2 seconds before showing the wheel
        setTimeout(() => {
          document.getElementById("loading-gif").style.display = "none"; // ✅ Hide Loading GIF
          document.getElementById("wheel").style.display = "block"; // ✅ Show the wheel
          updateWheel(restaurants); // ✅ Update the wheel with restaurant names
        }, 2000);
  
      }, (error) => {
        console.error("❌ Geolocation error:", error);
        alert("Please enable location access to fetch restaurants.");
        document.getElementById("loading-gif").style.display = "none"; // ✅ Hide loading GIF on error
        document.getElementById("wheel").style.display = "block";
      });
    } catch (error) {
      console.error("❌ Error fetching restaurants:", error);
      document.getElementById("loading-gif").style.display = "none"; // ✅ Hide loading GIF on error
      document.getElementById("wheel").style.display = "block";
    }
}

function updateWheel(restaurants) {
  options.length = 0; // Clear the current options array

  // Randomly shuffle the restaurants array
  const shuffledRestaurants = [...restaurants].sort(() => Math.random() - 0.5);

  // Choose 8 random restaurants
  const selectedRestaurants = shuffledRestaurants.slice(0, 8);

  // Extract restaurant names and Google Maps links, and populate options array
  options.push(...selectedRestaurants.map((restaurant) => ({
    name: restaurant.name,
    googleMapsLink: restaurant.googleMapsLink, // Add Google Maps link
  })));

  // Debugging: Log the selected restaurants with their links
  console.log("✅ Options for the Wheel:", options);

  // Store full restaurant details, including names and links
  restaurantDetails = selectedRestaurants.map((restaurant) => ({
    name: restaurant.name,
    googleMapsLink: restaurant.googleMapsLink // Add the Google Maps link
  }));

  console.log("✅ Selected Restaurants for the Wheel:", restaurantDetails);

  // Redraw the wheel with the updated options
  drawWheel();
}

// 🛠️ Toggle Settings View
function showSettings() {
  document.getElementById("main-view").style.display = "none";
  document.getElementById("settings-view").style.display = "block";
}

function hideSettings() {
  document.getElementById("main-view").style.display = "block";
  document.getElementById("settings-view").style.display = "none";
}

// 🛠️ Toggle History View
function showHistory() {
  document.getElementById("main-view").style.display = "none";
  document.getElementById("history-view").style.display = "block";
  
  // Load and display history
  loadHistory();
}

function hideHistory() {
  document.getElementById("main-view").style.display = "block";
  document.getElementById("history-view").style.display = "none";
}

// Load restaurant history from storage and display it
function loadHistory() {
  const historyList = document.getElementById("history-list");
  
  chrome.storage.sync.get(['restaurantHistory'], (result) => {
    const history = result.restaurantHistory || [];
    
    // Clear the history list first
    historyList.innerHTML = '';
    
    if (history.length === 0) {
      // Show empty history message
      const emptyMsg = document.createElement("div");
      emptyMsg.className = "empty-history";
      emptyMsg.textContent = "No restaurant history yet. Spin the wheel to get started!";
      historyList.appendChild(emptyMsg);
      return;
    }
    
    // Create and append history items
    history.forEach(entry => {
      const historyItem = document.createElement("div");
      historyItem.className = "history-item";
      
      const restaurantInfo = document.createElement("div");
      restaurantInfo.className = "restaurant-info";
      
      const restaurantName = document.createElement("div");
      restaurantName.className = "restaurant-name";
      restaurantName.textContent = entry.name;
      
      const restaurantDate = document.createElement("div");
      restaurantDate.className = "restaurant-date";
      restaurantDate.textContent = `${entry.date} at ${entry.time}`;
      
      restaurantInfo.appendChild(restaurantName);
      restaurantInfo.appendChild(restaurantDate);
      
      const restaurantLink = document.createElement("a");
      restaurantLink.className = "restaurant-link";
      restaurantLink.href = entry.googleMapsLink;
      restaurantLink.target = "_blank";
      restaurantLink.textContent = "View on Map";
      
      historyItem.appendChild(restaurantInfo);
      historyItem.appendChild(restaurantLink);
      
      historyList.appendChild(historyItem);
    });
  });
}

// Clear all restaurant history
function clearHistory() {
  // Ask for confirmation before clearing
  swal({
    title: "Clear History",
    text: "Are you sure you want to clear your restaurant history?",
    icon: "warning",
    buttons: ["Cancel", "Clear"],
    dangerMode: true,
  }).then((willClear) => {
    if (willClear) {
      // Clear history from storage
      chrome.storage.sync.set({ restaurantHistory: [] }, () => {
        // Reload the history view
        loadHistory();
        
        // Show confirmation
        swal({
          title: "History Cleared",
          icon: "success",
          button: false,
          timer: 1500,
        });
      });
    }
  });
}

// Ensure scripts run only after DOM is loaded
document.addEventListener("DOMContentLoaded", async () => {
  await fetchRestaurants();

  // Spin button event
  document.getElementById("spin").addEventListener("click", () => spin());

  // Open settings view
  document.getElementById("open-settings").addEventListener("click", showSettings);

  // Close settings view
  document.getElementById("close-settings").addEventListener("click", hideSettings);
  
  // Open history view
  document.getElementById("open-history").addEventListener("click", showHistory);
  
  // Close history view
  document.getElementById("close-history").addEventListener("click", hideHistory);
  
  // Clear history
  document.getElementById("clear-history").addEventListener("click", clearHistory);

  // Load saved settings into inputs
  const settings = await loadSettings();
  document.getElementById("distance").value = settings.distance;
  document.getElementById("price").value = settings.price;

  // Save settings
  document.getElementById("save-settings").addEventListener("click", async () => {
    const distance = parseFloat(document.getElementById("distance").value);
    const price = document.getElementById("price").value;
  
    // Save the updated settings
    chrome.storage.sync.set({ distance, price }, async () => {
      swal({
        title: `Settings saved!`,
        icon: "success",
        button: false, // Hide the default OK button
      });
  
      // Hide the settings view and fetch new restaurants
      hideSettings();
      await fetchRestaurants(); // Fetch restaurants with the new settings
    });
  });
});