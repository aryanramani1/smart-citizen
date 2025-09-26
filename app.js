// Global Variables
let currentUser = null;
let currentLocation = null;
let locationMap = null;
let mainMap = null;
let isRecording = false;
let recognition = null;
let mediaRecorder = null;
let audioChunks = [];

// Initialize App
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    
    // Initialize demo data if no data exists
    if (!localStorage.getItem('smartcitizen_users')) {
        generateDemoData();
    }
});

function initializeApp() {
    // Check if user is already logged in
    const savedUser = localStorage.getItem('smartcitizen_user');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        updateAuthUI();
    }

    // Initialize speech recognition if available
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'hi-IN'; // Hindi language
        
        recognition.onresult = function(event) {
            const transcript = event.results[0][0].transcript;
            document.getElementById('voicePreview').innerHTML = 
                `<p><strong>Recorded:</strong> ${transcript}</p>`;
            // Auto-translate and add to description
            translateAndAddToDescription(transcript);
        };
        
        recognition.onerror = function(event) {
            showNotification('Voice recognition error: ' + event.error, 'error');
        };
    }

    // Initialize navigation
    initializeNavigation();
    
    // Load initial data
    updateStats();
    
    // Set up photo input handler
    setupPhotoHandler();
    
    // Initialize maps when sections are shown
    setupMapInitialization();
}

// Navigation Functions
function initializeNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const targetSection = this.getAttribute('href').substring(1);
            showSection(targetSection);
        });
    });
}

function showSection(sectionName) {
    // Hide all sections
    const sections = document.querySelectorAll('.section');
    sections.forEach(section => {
        section.classList.remove('active');
    });

    // Show target section
    const targetSection = document.getElementById(sectionName);
    if (targetSection) {
        targetSection.classList.add('active');
    }

    // Initialize maps if needed
    if (sectionName === 'map' && !mainMap) {
        setTimeout(initializeMainMap, 100);
    } else if (sectionName === 'report' && !locationMap) {
        setTimeout(initializeLocationMap, 100);
    }

    // Load section-specific data
    if (sectionName === 'dashboard' && currentUser) {
        loadUserDashboard();
    } else if (sectionName === 'authority' && currentUser && currentUser.isAuthority) {
        loadAuthorityDashboard();
    }

    // Close mobile menu
    const navMenu = document.getElementById('navMenu');
    navMenu.classList.remove('active');
}

function toggleMenu() {
    const navMenu = document.getElementById('navMenu');
    navMenu.classList.toggle('active');
}

// Authentication Functions
function showLogin() {
    closeModal('registerModal');
    document.getElementById('loginModal').style.display = 'block';
}

function showRegister() {
    closeModal('loginModal');
    document.getElementById('registerModal').style.display = 'block';
}

function showPrivacyPolicy() {
    document.getElementById('privacyModal').style.display = 'block';
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

function login(event) {
    event.preventDefault();
    
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    // Simple demo authentication - in real app, this would be server-side
    const users = JSON.parse(localStorage.getItem('smartcitizen_users') || '[]');
    const user = users.find(u => (u.email === email || u.phone === email) && u.password === password);

    if (user) {
        currentUser = user;
        localStorage.setItem('smartcitizen_user', JSON.stringify(user));
        updateAuthUI();
        closeModal('loginModal');
        showNotification('Welcome back, ' + user.name + '!');
    } else {
        showNotification('Invalid credentials', 'error');
    }
}

function register(event) {
    event.preventDefault();
    
    const name = document.getElementById('registerName').value;
    const email = document.getElementById('registerEmail').value;
    const phone = document.getElementById('registerPhone').value;
    const password = document.getElementById('registerPassword').value;
    const isAuthority = document.getElementById('isAuthority').checked;
    const agreePrivacyEl = document.getElementById('agreePrivacy');
    const agreePrivacy = agreePrivacyEl ? agreePrivacyEl.checked : false;

    // Basic validation
    if (!name || !email || !phone || !password) {
        showNotification('Please fill in all required fields', 'warning');
        return;
    }

    if (!agreePrivacy) {
        showNotification('Please agree to the Privacy Policy to continue', 'warning');
        return;
    }

    // Generate unique ID
    const userId = 'SC' + Date.now().toString(36) + Math.random().toString(36).substr(2);

    const newUser = {
        id: userId,
        name: name,
        email: email,
        phone: phone,
        password: password, // In real app, this would be hashed
        isAuthority: isAuthority,
        reputationPoints: 0,
        badges: [],
        joinDate: new Date().toISOString()
    };

    // Save to localStorage (in real app, this would be server-side)
    const users = JSON.parse(localStorage.getItem('smartcitizen_users') || '[]');
    
    // Check if user already exists
    if (users.some(u => u.email === email || u.phone === phone)) {
        showNotification('User with this email or phone already exists', 'error');
        return;
    }

    users.push(newUser);
    localStorage.setItem('smartcitizen_users', JSON.stringify(users));
    
    currentUser = newUser;
    localStorage.setItem('smartcitizen_user', JSON.stringify(newUser));
    
    updateAuthUI();
    closeModal('registerModal');
    showNotification('Registration successful! Welcome to SmartCitizen, ' + name + '!');
}

function logout() {
    currentUser = null;
    localStorage.removeItem('smartcitizen_user');
    updateAuthUI();
    showSection('home');
    showNotification('Logged out successfully');
}

function updateAuthUI() {
    const authButtons = document.getElementById('authButtons');
    const userInfo = document.getElementById('userInfo');
    const userGreeting = document.getElementById('userGreeting');
    const authorityLink = document.getElementById('authorityLink');

    if (currentUser) {
        authButtons.style.display = 'none';
        userInfo.style.display = 'flex';
        userGreeting.textContent = `Hello, ${currentUser.name}`;
        
        // Show authority link if user is authority
        if (currentUser.isAuthority) {
            authorityLink.style.display = 'block';
        } else {
            authorityLink.style.display = 'none';
        }
    } else {
        authButtons.style.display = 'flex';
        userInfo.style.display = 'none';
        authorityLink.style.display = 'none';
    }
}

// Photo Handling
function setupPhotoHandler() {
    const photoInput = document.getElementById('photoInput');
    photoInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                const photoPreview = document.getElementById('photoPreview');
                photoPreview.innerHTML = `<img src="${e.target.result}" alt="Issue photo">`;
            };
            reader.readAsDataURL(file);
        }
    });
}

// Voice Recording Functions
function toggleVoiceRecording() {
    const voiceBtn = document.getElementById('voiceBtn');
    const voiceStatus = document.getElementById('voiceStatus');

    if (!isRecording) {
        startVoiceRecording();
        voiceBtn.classList.add('voice-recording');
        voiceStatus.textContent = 'Recording... Click to stop';
        isRecording = true;
    } else {
        stopVoiceRecording();
        voiceBtn.classList.remove('voice-recording');
        voiceStatus.textContent = 'Start Recording';
        isRecording = false;
    }
}

function startVoiceRecording() {
    if (recognition) {
        recognition.start();
    } else {
        // Fallback for browsers without speech recognition
        showNotification('Speech recognition not supported in this browser', 'warning');
    }
}

function stopVoiceRecording() {
    if (recognition) {
        recognition.stop();
    }
}

// AI Description Generation
async function generateAIDescription() {
    const btn = document.querySelector('.btn-ai');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<div class="loading"></div> Generating...';
    btn.disabled = true;

    try {
        // Simulate AI processing (in real app, this would call actual AI service)
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const category = document.getElementById('issueCategory').value;
        const photoPreview = document.getElementById('photoPreview').innerHTML;
        const voicePreview = document.getElementById('voicePreview').innerHTML;
        
        let description = generateMockAIDescription(category, photoPreview, voicePreview);
        
        // Translate to Hindi (mock translation)
        const hindiDescription = await mockTranslateToHindi(description);
        
        document.getElementById('issueDescription').value = hindiDescription;
        showNotification('AI description generated successfully!');
        
    } catch (error) {
        showNotification('Failed to generate AI description', 'error');
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

function generateMockAIDescription(category, hasPhoto, hasVoice) {
    const descriptions = {
        road: 'Road damage with potholes affecting vehicle movement',
        water: 'Water leakage or drainage blockage requiring immediate attention',
        electricity: 'Electrical fault or power outage in the area',
        garbage: 'Garbage accumulation or improper waste disposal',
        traffic: 'Traffic congestion or parking violation',
        other: 'Civic issue requiring local authority intervention'
    };
    
    let baseDescription = descriptions[category] || descriptions.other;
    
    if (hasPhoto) {
        baseDescription += '. Photo evidence attached showing the current situation';
    }
    
    if (hasVoice) {
        baseDescription += '. Additional voice description provided by the reporter';
    }
    
    return baseDescription;
}

async function mockTranslateToHindi(text) {
    // Mock Hindi translation (in real app, use Google Translate API or similar)
    const translations = {
        'Road damage with potholes affecting vehicle movement': 'सड़क में गड्ढे हैं जो वाहनों की आवाजाही में बाधा डाल रहे हैं',
        'Water leakage or drainage blockage requiring immediate attention': 'पानी का रिसाव या नाली में रुकावट है जिस पर तुरंत ध्यान देने की जरूरत है',
        'Electrical fault or power outage in the area': 'क्षेत्र में बिजली की खराबी या बिजली कटौती है',
        'Garbage accumulation or improper waste disposal': 'कूड़े का संचय या अनुचित कचरा निपटान',
        'Traffic congestion or parking violation': 'यातायात जाम या पार्किंग का उल्लंघन',
        'Civic issue requiring local authority intervention': 'नागरिक समस्या जिसमें स्थानीय प्राधिकरण के हस्तक्षेप की आवश्यकता है'
    };
    
    return translations[text.split('.')[0]] || 'नागरिक समस्या की रिपोर्ट';
}

async function translateAndAddToDescription(voiceText) {
    const hindiTranslation = await mockTranslateToHindi(voiceText);
    const currentDescription = document.getElementById('issueDescription').value;
    const newDescription = currentDescription ? 
        currentDescription + '\n\nआवाज़ से: ' + hindiTranslation :
        'आवाज़ से: ' + hindiTranslation;
    document.getElementById('issueDescription').value = newDescription;
}

// Location Functions
function getCurrentLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            function(position) {
                currentLocation = {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude
                };
                
                document.getElementById('locationText').value = 
                    `Lat: ${currentLocation.latitude.toFixed(6)}, Lng: ${currentLocation.longitude.toFixed(6)}`;
                
                if (locationMap) {
                    updateLocationMap();
                } else {
                    initializeLocationMap();
                }
                
                showNotification('Location detected successfully');
            },
            function(error) {
                showNotification('Error getting location: ' + error.message, 'error');
            }
        );
    } else {
        showNotification('Geolocation is not supported by this browser', 'error');
    }
}

function initializeLocationMap() {
    const mapElement = document.getElementById('locationMap');
    if (!mapElement) return;

    // Default to Delhi if no location
    const lat = currentLocation ? currentLocation.latitude : 28.6139;
    const lng = currentLocation ? currentLocation.longitude : 77.2090;

    locationMap = L.map('locationMap').setView([lat, lng], 15);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(locationMap);

    if (currentLocation) {
        L.marker([lat, lng])
            .addTo(locationMap)
            .bindPopup('Your current location')
            .openPopup();
    }
}

function updateLocationMap() {
    if (locationMap && currentLocation) {
        locationMap.setView([currentLocation.latitude, currentLocation.longitude], 15);
        
        // Clear existing markers
        locationMap.eachLayer(function(layer) {
            if (layer instanceof L.Marker) {
                locationMap.removeLayer(layer);
            }
        });
        
        // Add new marker
        L.marker([currentLocation.latitude, currentLocation.longitude])
            .addTo(locationMap)
            .bindPopup('Your current location')
            .openPopup();
    }
}

// Map Functions
function initializeMainMap() {
    const mapElement = document.getElementById('mainMap');
    if (!mapElement) return;

    mainMap = L.map('mainMap').setView([28.6139, 77.2090], 12);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(mainMap);

    loadIssuesOnMap();
}

function loadIssuesOnMap() {
    if (!mainMap) return;

    const issues = JSON.parse(localStorage.getItem('smartcitizen_issues') || '[]');
    
    issues.forEach(issue => {
        if (issue.location) {
            const markerColor = getStatusColor(issue.status);
            const marker = L.marker([issue.location.latitude, issue.location.longitude])
                .addTo(mainMap);
            
            const popupContent = `
                <div class="issue-popup">
                    <h4>${issue.category}</h4>
                    <p><strong>Status:</strong> <span class="issue-status status-${issue.status}">${issue.status}</span></p>
                    <p><strong>Description:</strong> ${issue.description.substring(0, 100)}...</p>
                    <p><strong>Reported by:</strong> ${issue.reporterName}</p>
                    <p><strong>Date:</strong> ${new Date(issue.timestamp).toLocaleDateString()}</p>
                    <div class="voting-section">
                        <p><strong>Community Votes:</strong></p>
                        <div class="vote-results">
                            <span>👍 ${issue.votes ? issue.votes.yes : 0}</span>
                            <span>👎 ${issue.votes ? issue.votes.no : 0}</span>
                        </div>
                        ${currentUser && !issue.votes?.voters?.includes(currentUser.id) ? 
                            `<div class="voting-buttons">
                                <button class="btn-vote-yes" onclick="voteOnIssue('${issue.id}', true)">Verify</button>
                                <button class="btn-vote-no" onclick="voteOnIssue('${issue.id}', false)">Report Fake</button>
                            </div>` : ''
                        }
                    </div>
                </div>
            `;
            
            marker.bindPopup(popupContent);
        }
    });
}

function refreshMap() {
    if (mainMap) {
        // Clear existing markers
        mainMap.eachLayer(function(layer) {
            if (layer instanceof L.Marker) {
                mainMap.removeLayer(layer);
            }
        });
        loadIssuesOnMap();
    }
}

function getStatusColor(status) {
    switch(status) {
        case 'pending': return 'orange';
        case 'in-progress': return 'blue';
        case 'resolved': return 'green';
        default: return 'red';
    }
}

// Issue Submission
function submitIssue() {
    if (!currentUser) {
        showNotification('Please login to submit an issue', 'warning');
        showLogin();
        return;
    }

    const category = document.getElementById('issueCategory').value;
    const description = document.getElementById('issueDescription').value;
    
    if (!category || !description) {
        showNotification('Please fill in all required fields', 'warning');
        return;
    }

    if (!currentLocation) {
        showNotification('Please get your location first', 'warning');
        return;
    }

    const photoInput = document.getElementById('photoInput');
    const photoFile = photoInput.files[0];
    
    const issue = {
        id: 'ISSUE_' + Date.now().toString(36),
        category: category,
        description: description,
        location: currentLocation,
        reporterId: currentUser.id,
        reporterName: currentUser.name,
        timestamp: new Date().toISOString(),
        status: 'pending',
        votes: {
            yes: 0,
            no: 0,
            voters: []
        },
        photo: photoFile ? URL.createObjectURL(photoFile) : null
    };

    // Save issue
    const issues = JSON.parse(localStorage.getItem('smartcitizen_issues') || '[]');
    issues.push(issue);
    localStorage.setItem('smartcitizen_issues', JSON.stringify(issues));

    // Award points to user
    currentUser.reputationPoints += 10;
    awardBadgeIfEligible('reporter');
    updateUserInStorage();

    // Clear form
    document.getElementById('issueCategory').value = '';
    document.getElementById('issueDescription').value = '';
    document.getElementById('photoPreview').innerHTML = '';
    document.getElementById('voicePreview').innerHTML = '';
    photoInput.value = '';

    showNotification('Issue submitted successfully! You earned 10 reputation points.');
    updateStats();
}

// Voting System
function voteOnIssue(issueId, isApproval) {
    if (!currentUser) {
        showNotification('Please login to vote', 'warning');
        return;
    }

    const issues = JSON.parse(localStorage.getItem('smartcitizen_issues') || '[]');
    const issueIndex = issues.findIndex(issue => issue.id === issueId);
    
    if (issueIndex === -1) {
        showNotification('Issue not found', 'error');
        return;
    }

    const issue = issues[issueIndex];
    
    // Check if user already voted
    if (issue.votes.voters.includes(currentUser.id)) {
        showNotification('You have already voted on this issue', 'warning');
        return;
    }

    // Add vote
    if (isApproval) {
        issue.votes.yes++;
    } else {
        issue.votes.no++;
    }
    
    issue.votes.voters.push(currentUser.id);

    // Check if issue should be verified (e.g., 3+ yes votes)
    if (issue.votes.yes >= 3 && issue.status === 'pending') {
        issue.status = 'verified';
        showNotification('Issue has been verified by the community!');
    }

    // Award points to voter
    currentUser.reputationPoints += 2;
    awardBadgeIfEligible('voter');
    updateUserInStorage();

    // Save updated issues
    localStorage.setItem('smartcitizen_issues', JSON.stringify(issues));
    
    showNotification('Thank you for your vote! You earned 2 reputation points.');
    refreshMap();
}

// Badge System
function awardBadgeIfEligible(type) {
    const badgeTypes = {
        reporter: { threshold: 1, name: 'First Reporter', icon: 'fas fa-flag' },
        voter: { threshold: 5, name: 'Community Voter', icon: 'fas fa-vote-yea' },
        active: { threshold: 50, name: 'Active Citizen', icon: 'fas fa-star' },
        expert: { threshold: 100, name: 'Civic Expert', icon: 'fas fa-trophy' }
    };

    const badge = badgeTypes[type];
    if (!badge) return;

    const userIssues = JSON.parse(localStorage.getItem('smartcitizen_issues') || '[]')
        .filter(issue => issue.reporterId === currentUser.id);
    
    const shouldAward = type === 'reporter' ? userIssues.length >= badge.threshold :
                      type === 'voter' ? currentUser.reputationPoints >= badge.threshold * 2 :
                      currentUser.reputationPoints >= badge.threshold;

    if (shouldAward && !currentUser.badges.some(b => b.type === type)) {
        currentUser.badges.push({
            type: type,
            name: badge.name,
            icon: badge.icon,
            earnedDate: new Date().toISOString()
        });
        
        showNotification(`🏆 Badge Unlocked: ${badge.name}!`, 'success');
        updateUserInStorage();
    }
}

function updateUserInStorage() {
    localStorage.setItem('smartcitizen_user', JSON.stringify(currentUser));
    
    // Update user in users array
    const users = JSON.parse(localStorage.getItem('smartcitizen_users') || '[]');
    const userIndex = users.findIndex(u => u.id === currentUser.id);
    if (userIndex !== -1) {
        users[userIndex] = currentUser;
        localStorage.setItem('smartcitizen_users', JSON.stringify(users));
    }
}

// Dashboard Functions
function loadUserDashboard() {
    if (!currentUser) return;

    const issues = JSON.parse(localStorage.getItem('smartcitizen_issues') || '[]');
    const userIssues = issues.filter(issue => issue.reporterId === currentUser.id);

    // Update stats
    document.getElementById('userReports').textContent = userIssues.length;
    document.getElementById('userPoints').textContent = currentUser.reputationPoints;
    document.getElementById('userBadges').textContent = currentUser.badges.length;

    // Display badges
    const badgesContainer = document.getElementById('badgesContainer');
    badgesContainer.innerHTML = '';
    
    currentUser.badges.forEach(badge => {
        const badgeElement = document.createElement('div');
        badgeElement.className = 'badge-item';
        badgeElement.innerHTML = `
            <i class="${badge.icon}"></i>
            <span>${badge.name}</span>
        `;
        badgesContainer.appendChild(badgeElement);
    });

    // Display recent reports
    const reportsList = document.getElementById('userReportsList');
    reportsList.innerHTML = '';
    
    userIssues.slice(-5).reverse().forEach(issue => {
        const issueElement = document.createElement('div');
        issueElement.className = 'issue-item';
        issueElement.innerHTML = `
            <div class="issue-header">
                <h4>${issue.category}</h4>
                <span class="issue-status status-${issue.status}">${issue.status}</span>
            </div>
            <p>${issue.description}</p>
            <p><small>Reported on: ${new Date(issue.timestamp).toLocaleString()}</small></p>
            <div class="vote-results">
                <span>👍 ${issue.votes.yes}</span>
                <span>👎 ${issue.votes.no}</span>
            </div>
        `;
        reportsList.appendChild(issueElement);
    });
}

// Authority Dashboard
function loadAuthorityDashboard() {
    if (!currentUser || !currentUser.isAuthority) return;

    const issues = JSON.parse(localStorage.getItem('smartcitizen_issues') || '[]');
    const verifiedIssues = issues.filter(issue => issue.votes.yes >= 3);

    // Update stats
    const pending = verifiedIssues.filter(issue => issue.status === 'verified' || issue.status === 'pending').length;
    const inProgress = verifiedIssues.filter(issue => issue.status === 'in-progress').length;
    const resolved = verifiedIssues.filter(issue => issue.status === 'resolved').length;

    document.getElementById('pendingIssues').textContent = pending;
    document.getElementById('inProgressIssues').textContent = inProgress;
    document.getElementById('resolvedIssues').textContent = resolved;

    // Display issues list
    const issuesList = document.getElementById('authorityIssuesList');
    issuesList.innerHTML = '';

    verifiedIssues.forEach(issue => {
        const issueElement = document.createElement('div');
        issueElement.className = 'issue-item';
        issueElement.innerHTML = `
            <div class="issue-header">
                <h4>${issue.category}</h4>
                <span class="issue-status status-${issue.status}">${issue.status}</span>
            </div>
            <p>${issue.description}</p>
            <p><strong>Location:</strong> ${issue.location.latitude.toFixed(4)}, ${issue.location.longitude.toFixed(4)}</p>
            <p><strong>Reported by:</strong> ${issue.reporterName}</p>
            <p><strong>Community Votes:</strong> 👍 ${issue.votes.yes} 👎 ${issue.votes.no}</p>
            <div class="issue-actions">
                ${issue.status === 'pending' || issue.status === 'verified' ? 
                    `<button class="btn-progress" onclick="updateIssueStatus('${issue.id}', 'in-progress')">Mark In Progress</button>` : ''
                }
                ${issue.status === 'in-progress' ? 
                    `<button class="btn-resolve" onclick="updateIssueStatus('${issue.id}', 'resolved')">Mark Resolved</button>` : ''
                }
            </div>
        `;
        issuesList.appendChild(issueElement);
    });
}

function updateIssueStatus(issueId, newStatus) {
    const issues = JSON.parse(localStorage.getItem('smartcitizen_issues') || '[]');
    const issueIndex = issues.findIndex(issue => issue.id === issueId);
    
    if (issueIndex === -1) return;

    issues[issueIndex].status = newStatus;
    issues[issueIndex].lastUpdated = new Date().toISOString();
    issues[issueIndex].updatedBy = currentUser.id;

    localStorage.setItem('smartcitizen_issues', JSON.stringify(issues));

    // Notify all users if resolved
    if (newStatus === 'resolved') {
        // In a real app, this would send actual notifications
        showNotification('Issue has been marked as resolved. All users will be notified.');
    }

    loadAuthorityDashboard();
    updateStats();
    
    if (mainMap) {
        refreshMap();
    }
}

// Utility Functions
function updateStats() {
    const issues = JSON.parse(localStorage.getItem('smartcitizen_issues') || '[]');
    const users = JSON.parse(localStorage.getItem('smartcitizen_users') || '[]');

    document.getElementById('totalReports').textContent = issues.length;
    document.getElementById('resolvedReports').textContent = 
        issues.filter(issue => issue.status === 'resolved').length;
    document.getElementById('activeUsers').textContent = users.length;
}

function showNotification(message, type = 'success') {
    const container = document.getElementById('notificationContainer');
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    container.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 5000);
}

function setupMapInitialization() {
    // Initialize maps when their sections become visible
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                const target = mutation.target;
                if (target.classList.contains('active')) {
                    if (target.id === 'map' && !mainMap) {
                        setTimeout(initializeMainMap, 100);
                    } else if (target.id === 'report' && !locationMap) {
                        setTimeout(initializeLocationMap, 100);
                    }
                }
            }
        });
    });

    // Observe all sections
    document.querySelectorAll('.section').forEach(section => {
        observer.observe(section, { attributes: true });
    });
}

// Quick Submit for 7-second goal
function quickSubmit() {
    if (!currentUser) {
        showNotification('Please login to submit an issue', 'warning');
        showLogin();
        return;
    }

    // Auto-fill with smart defaults
    const category = document.getElementById('issueCategory').value || 'other';
    if (!category || category === '') {
        document.getElementById('issueCategory').value = 'other';
    }

    // Get location if not already obtained
    if (!currentLocation) {
        getCurrentLocation();
        setTimeout(() => {
            // Retry after location is obtained
            if (currentLocation) {
                proceedWithQuickSubmit();
            } else {
                showNotification('Location required for quick submit', 'warning');
            }
        }, 2000);
    } else {
        proceedWithQuickSubmit();
    }
}

function proceedWithQuickSubmit() {
    const category = document.getElementById('issueCategory').value;
    let description = document.getElementById('issueDescription').value;
    
    // Auto-generate description if empty
    if (!description) {
        const quickDescriptions = {
            road: 'सड़क में समस्या है जिसे तुरंत ठीक करने की जरूरत है',
            water: 'पानी या नाली की समस्या है',
            electricity: 'बिजली की समस्या है',
            garbage: 'कूड़े की समस्या है',
            traffic: 'यातायात की समस्या है',
            other: 'नागरिक समस्या है जिस पर ध्यान देना आवश्यक है'
        };
        description = quickDescriptions[category] || quickDescriptions.other;
        document.getElementById('issueDescription').value = description;
    }

    // Submit immediately
    submitIssue();
    showNotification('⚡ Quick submit completed in under 7 seconds!', 'success');
}

// Demo Data Generation (for testing)
function generateDemoData() {
    // Create demo users
    const demoUsers = [
        {
            id: 'SC_DEMO_AUTH',
            name: 'Authority Demo',
            email: 'authority@demo.com',
            phone: '+919999999999',
            password: 'demo123',
            isAuthority: true,
            reputationPoints: 0,
            badges: [],
            joinDate: new Date().toISOString()
        }
    ];

    localStorage.setItem('smartcitizen_users', JSON.stringify(demoUsers));

    // Create demo issues
    const demoIssues = [
        {
            id: 'ISSUE_DEMO_1',
            category: 'road',
            description: 'सड़क में बड़े गड्ढे हैं जो यातायात में समस्या पैदा कर रहे हैं',
            location: { latitude: 28.6139, longitude: 77.2090 },
            reporterId: 'DEMO_USER_1',
            reporterName: 'Demo Citizen',
            timestamp: new Date(Date.now() - 86400000).toISOString(),
            status: 'pending',
            votes: { yes: 5, no: 0, voters: ['user1', 'user2', 'user3', 'user4', 'user5'] }
        }
    ];

    localStorage.setItem('smartcitizen_issues', JSON.stringify(demoIssues));
}