// Global Variables
let currentUser = null;
let currentQuestionId = null;
let isSignupMode = false;

// DOM Elements
const authButtons = document.getElementById('auth-buttons');
const userMenu = document.getElementById('user-menu');
const authModal = document.getElementById('auth-modal');
const overlay = document.getElementById('overlay');
const questionsList = document.getElementById('questions-list');

// Page Elements
const homePage = document.getElementById('home-page');
const askQuestionPage = document.getElementById('ask-question-page');
const questionDetailPage = document.getElementById('question-detail-page');
const profilePage = document.getElementById('profile-page');

// Initialize App
document.addEventListener('DOMContentLoaded', function() {
    console.log('App initializing...');
    
    // Check authentication state
    auth.onAuthStateChanged(user => {
        if (user) {
            currentUser = user;
            showUserMenu();
            createUserDocument(user);
        } else {
            currentUser = null;
            showAuthButtons();
        }
    });
    
    // Load initial questions
    loadQuestions();
    
    // Setup event listeners
    setupEventListeners();
});

// Authentication Functions
function showLoginModal() {
    isSignupMode = false;
    document.getElementById('auth-modal-title').textContent = 'Login';
    document.getElementById('auth-submit-btn').textContent = 'Login';
    document.getElementById('auth-switch-text').textContent = "Don't have an account?";
    document.getElementById('auth-switch-link').textContent = 'Sign up';
    showModal();
}

function showSignupModal() {
    isSignupMode = true;
    document.getElementById('auth-modal-title').textContent = 'Sign Up';
    document.getElementById('auth-submit-btn').textContent = 'Sign Up';
    document.getElementById('auth-switch-text').textContent = 'Already have an account?';
    document.getElementById('auth-switch-link').textContent = 'Login';
    showModal();
}

function toggleAuthMode() {
    if (isSignupMode) {
        showLoginModal();
    } else {
        showSignupModal();
    }
}

function showModal() {
    authModal.style.display = 'flex';
    overlay.style.display = 'block';
    document.body.style.overflow = 'hidden';
}

function closeAuthModal() {
    authModal.style.display = 'none';
    overlay.style.display = 'none';
    document.body.style.overflow = 'auto';
    document.getElementById('email-auth-form').reset();
}

function showUserMenu() {
    authButtons.style.display = 'none';
    userMenu.style.display = 'block';
    
    document.getElementById('user-name').textContent = currentUser.displayName || currentUser.email.split('@')[0];
    document.getElementById('user-avatar').src = currentUser.photoURL || `https://ui-avatars.com/api/?name=${currentUser.displayName || currentUser.email}&background=random`;
    
    loadUserReputation();
}

function showAuthButtons() {
    authButtons.style.display = 'flex';
    userMenu.style.display = 'none';
}

async function signInWithGoogle() {
    try {
        const result = await auth.signInWithPopup(googleProvider);
        console.log('Google sign-in successful:', result.user);
        closeAuthModal();
    } catch (error) {
        console.error('Google sign-in error:', error);
        alert('Google sign-in failed: ' + error.message);
    }
}

async function signInWithEmail(email, password) {
    try {
        if (isSignupMode) {
            const result = await auth.createUserWithEmailAndPassword(email, password);
            console.log('Sign-up successful:', result.user);
        } else {
            const result = await auth.signInWithEmailAndPassword(email, password);
            console.log('Sign-in successful:', result.user);
        }
        closeAuthModal();
    } catch (error) {
        console.error('Email auth error:', error);
        alert('Authentication failed: ' + error.message);
    }
}

async function logout() {
    try {
        await auth.signOut();
        showHome();
        console.log('User signed out');
    } catch (error) {
        console.error('Logout error:', error);
    }
}

// User Management
async function createUserDocument(user) {
    try {
        const userRef = db.collection('users').doc(user.uid);
        const userDoc = await userRef.get();
        
        if (!userDoc.exists) {
            const userData = {
                displayName: user.displayName || user.email.split('@')[0],
                firstName: '',
                lastName: '',
                email: user.email || '',
                photoURL: user.photoURL || '',
                reputation: 0,
                joinDate: firebase.firestore.FieldValue.serverTimestamp(),
                questionsAsked: 0,
                answersGiven: 0
            };
            
            if (user.providerData.some(p => p.providerId === 'google.com') && user.displayName) {
                const nameParts = user.displayName.split(' ');
                userData.firstName = nameParts[0] || '';
                userData.lastName = nameParts.slice(1).join(' ') || '';
            }
            
            await userRef.set(userData);
            console.log('User document created successfully');
        } else {
            console.log('User document already exists');
        }
    } catch (error) {
        console.error('Error creating user document:', error);
    }
}

async function loadUserReputation() {
    if (!currentUser) return;
    try {
        const userDoc = await db.collection('users').doc(currentUser.uid).get();
        if (userDoc.exists) {
            document.getElementById('user-rep').textContent = userDoc.data().reputation || 0;
        }
    } catch (error) {
        console.error('Error loading user reputation:', error);
        document.getElementById('user-rep').textContent = '0';
    }
}

// Navigation Functions
function showHome() {
    homePage.style.display = 'block';
    askQuestionPage.style.display = 'none';
    questionDetailPage.style.display = 'none';
    profilePage.style.display = 'none';
    loadQuestions();
}

function showAskQuestion() {
    if (!currentUser) {
        showLoginModal();
        return;
    }
    homePage.style.display = 'none';
    askQuestionPage.style.display = 'block';
    questionDetailPage.style.display = 'none';
    profilePage.style.display = 'none';
}

function showQuestionDetail(questionId) {
    currentQuestionId = questionId;
    homePage.style.display = 'none';
    askQuestionPage.style.display = 'none';
    questionDetailPage.style.display = 'block';
    profilePage.style.display = 'none';
    loadQuestionDetail(questionId);
}

// Profile Page Functions
function showProfilePage() {
    if (!currentUser) {
        showLoginModal();
        return;
    }
    homePage.style.display = 'none';
    askQuestionPage.style.display = 'none';
    questionDetailPage.style.display = 'none';
    profilePage.style.display = 'block';

    toggleUserMenu(true); // Close dropdown
    loadProfileData();
}

async function loadProfileData() {
    if (!currentUser) return;
    document.getElementById('profile-email').value = currentUser.email || '';
    
    try {
        const userRef = db.collection('users').doc(currentUser.uid);
        const userDoc = await userRef.get();
        if (userDoc.exists) {
            const userData = userDoc.data();
            document.getElementById('profile-first-name').value = userData.firstName || '';
            document.getElementById('profile-last-name').value = userData.lastName || '';
            const photoURL = userData.photoURL || '';
            document.getElementById('profile-photo-url').value = photoURL;
            document.getElementById('profile-avatar-preview').src = photoURL || `https://ui-avatars.com/api/?name=${userData.displayName}&background=random&size=80`;
        }
    } catch (error) {
        console.error('Error loading user profile data:', error);
        alert('Could not load your profile data.');
    }
}

async function updateUserProfile(event) {
    event.preventDefault();
    if (!currentUser) return;

    const firstName = document.getElementById('profile-first-name').value.trim();
    const lastName = document.getElementById('profile-last-name').value.trim();
    const photoURL = document.getElementById('profile-photo-url').value.trim();
    const newDisplayName = `${firstName} ${lastName}`.trim();

    if (!newDisplayName) {
        alert('Please provide at least a first or last name.');
        return;
    }

    try {
        await currentUser.updateProfile({ displayName: newDisplayName, photoURL: photoURL });
        await db.collection('users').doc(currentUser.uid).update({
            firstName: firstName,
            lastName: lastName,
            displayName: newDisplayName,
            photoURL: photoURL
        });

        currentUser = auth.currentUser; // Re-fetch to get updated values
        showUserMenu();
        
        alert('Profile updated successfully!');
        showHome();
    } catch (error) {
        console.error('Error updating profile:', error);
        alert('Failed to update profile: ' + error.message);
    }
}

// Questions Functions
async function loadQuestions(filter = 'newest') {
    try {
        questionsList.innerHTML = '<div class="loading">Loading questions...</div>';
        let query = db.collection('questions');
        switch (filter) {
            case 'votes': query = query.orderBy('voteCount', 'desc'); break;
            case 'answers': query = query.orderBy('answerCount', 'desc'); break;
            default: query = query.orderBy('timestamp', 'desc');
        }
        const snapshot = await query.limit(20).get();
        if (snapshot.empty) {
            questionsList.innerHTML = '<div class="loading">No questions yet. Be the first to ask!</div>';
            return;
        }
        const questionsHTML = snapshot.docs.map(doc => createQuestionCard(doc.id, doc.data())).join('');
        questionsList.innerHTML = questionsHTML;
    } catch (error) {
        console.error('Error loading questions:', error);
        questionsList.innerHTML = '<div class="loading">Error loading questions. Please try again.</div>';
    }
}

function createQuestionCard(id, question) {
    const timeAgo = getTimeAgo(question.timestamp?.toDate());
    const excerpt = question.body.length > 150 ? question.body.substring(0, 150) + '...' : question.body;
    const authorPhoto = question.authorPhoto || `https://ui-avatars.com/api/?name=${question.authorName}&background=random`;
    
    return `
        <div class="question-card" onclick="showQuestionDetail('${id}')">
            <div class="question-stats">
                <div class="stat"><span class="stat-number">${question.voteCount || 0}</span><span>votes</span></div>
                <div class="stat"><span class="stat-number">${question.answerCount || 0}</span><span>answers</span></div>
            </div>
            <h3 class="question-title">${escapeHtml(question.title)}</h3>
            <p class="question-excerpt">${escapeHtml(excerpt)}</p>
            <div class="question-meta">
                <div class="question-author">
                    <img src="${authorPhoto}" alt="Author" class="author-avatar">
                    <span>${escapeHtml(question.authorName)}</span>
                </div>
                <span class="question-time">${timeAgo}</span>
            </div>
        </div>
    `;
}

async function submitQuestion(event) {
    event.preventDefault();
    if (!currentUser) { showLoginModal(); return; }
    const title = document.getElementById('question-title').value.trim();
    const body = document.getElementById('question-body').value.trim();
    if (!title || !body) { alert('Please fill in both title and body'); return; }
    
    try {
        const questionData = {
            title: title,
            body: body,
            authorId: currentUser.uid,
            authorName: currentUser.displayName || currentUser.email,
            authorPhoto: currentUser.photoURL || '',
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            voteCount: 0,
            answerCount: 0,
            votes: {}
        };
        const docRef = await db.collection('questions').add(questionData);
        
        // Update user stats and reputation (+1 for asking a question)
        await db.collection('users').doc(currentUser.uid).update({
            questionsAsked: firebase.firestore.FieldValue.increment(1),
            reputation: firebase.firestore.FieldValue.increment(1)
        });
        
        document.getElementById('ask-question-form').reset();
        showQuestionDetail(docRef.id);
        
        // Update displayed reputation
        loadUserReputation();
    } catch (error) {
        console.error('Error posting question:', error);
        alert('Error posting question. Please try again.');
    }
}

async function loadQuestionDetail(questionId) {
    try {
        const questionDoc = await db.collection('questions').doc(questionId).get();
        if (!questionDoc.exists) {
            document.getElementById('question-detail').innerHTML = '<p>Question not found.</p>';
            return;
        }
        const question = questionDoc.data();
        const timeAgo = getTimeAgo(question.timestamp?.toDate());
        const isQuestionAuthor = currentUser && question.authorId === currentUser.uid;
        const questionHTML = `
            <div class="question-header">
                <h1>${escapeHtml(question.title)}</h1>
                <div class="question-meta"><span>Asked ${timeAgo} by ${escapeHtml(question.authorName)}</span></div>
            </div>
            <div style="display: flex; align-items: flex-start; gap: 20px;">
                <div class="question-votes">
                    <button class="vote-btn" onclick="voteQuestion('${questionId}', 1)" ${!currentUser || isQuestionAuthor ? 'disabled' : ''}>▲</button>
                    <span class="vote-count">${question.voteCount || 0}</span>
                    <button class="vote-btn" onclick="voteQuestion('${questionId}', -1)" ${!currentUser || isQuestionAuthor ? 'disabled' : ''}>▼</button>
                </div>
                <div style="flex: 1;"><div class="question-body">${escapeHtml(question.body).replace(/\n/g, '<br>')}</div></div>
            </div>`;
        document.getElementById('question-detail').innerHTML = questionHTML;
        loadAnswers(questionId);
        document.getElementById('answer-form-section').style.display = currentUser ? 'block' : 'none';
    } catch (error) {
        console.error('Error loading question detail:', error);
        document.getElementById('question-detail').innerHTML = '<p>Error loading question.</p>';
    }
}

async function loadAnswers(questionId) {
    try {
        const answersSnapshot = await db.collection('answers').where('questionId', '==', questionId).get();
        const answerCount = answersSnapshot.size;
        document.getElementById('answers-count').textContent = `${answerCount} Answer${answerCount !== 1 ? 's' : ''}`;
        const answersListElement = document.getElementById('answers-list');
        if (answerCount === 0) {
            answersListElement.innerHTML = '<p class="text-muted">No answers yet. Be the first to answer!</p>';
            return;
        }
        const answersData = answersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        answersData.sort((a, b) => (b.voteCount || 0) - (a.voteCount || 0));
        const answersHTML = answersData.map(answer => {
            const timeAgo = getTimeAgo(answer.timestamp?.toDate());
            const authorPhoto = answer.authorPhoto || `https://ui-avatars.com/api/?name=${answer.authorName}&background=random`;
            const isAuthor = currentUser && answer.authorId === currentUser.uid;
            
            // Add delete button for answer author
            const deleteButton = isAuthor ? 
                `<button class="delete-btn" onclick="deleteAnswer('${answer.id}')" title="Delete answer">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3,6 5,6 21,6"></polyline>
                        <path d="m19,6v14a2,2 0 0,1-2,2H7a2,2 0 0,1-2-2V6m3,0V4a2,2 0 0,1,2-2h4a2,2 0 0,1,2,2v2"></path>
                        <line x1="10" y1="11" x2="10" y2="17"></line>
                        <line x1="14" y1="11" x2="14" y2="17"></line>
                    </svg>
                </button>` : '';
            
            return `
                <div class="answer-card">
                    <div style="display: flex; align-items: flex-start; gap: 20px;">
                        <div class="question-votes">
                            <button class="vote-btn" onclick="voteAnswer('${answer.id}', 1)" ${!currentUser || isAuthor ? 'disabled' : ''}>▲</button>
                            <span class="vote-count">${answer.voteCount || 0}</span>
                            <button class="vote-btn" onclick="voteAnswer('${answer.id}', -1)" ${!currentUser || isAuthor ? 'disabled' : ''}>▼</button>
                        </div>
                        <div style="flex: 1;">
                            <div class="answer-body">${escapeHtml(answer.body).replace(/\n/g, '<br>')}</div>
                            <div class="question-meta mt-20">
                                <div class="question-author">
                                    <img src="${authorPhoto}" alt="Author" class="author-avatar">
                                    <span>${escapeHtml(answer.authorName)}</span>
                                </div>
                                <span>${timeAgo}</span>
                                ${deleteButton}
                            </div>
                        </div>
                    </div>
                </div>`;
        }).join('');
        answersListElement.innerHTML = answersHTML;
    } catch (error) {
        console.error('Error loading answers:', error);
    }
}

async function deleteAnswer(answerId) {
    if (!currentUser) {
        showLoginModal();
        return;
    }
    
    // Confirm deletion
    if (!confirm('Are you sure you want to delete this answer? This action cannot be undone.')) {
        return;
    }
    
    try {
        await db.runTransaction(async (transaction) => {
            const answerRef = db.collection('answers').doc(answerId);
            const answerDoc = await transaction.get(answerRef);
            
            if (!answerDoc.exists) {
                throw new Error("Answer does not exist!");
            }
            
            const answerData = answerDoc.data();
            
            // Check if current user is the author
            if (answerData.authorId !== currentUser.uid) {
                throw new Error("You can only delete your own answers.");
            }
            
            // Delete the answer
            transaction.delete(answerRef);
            
            // Update question answer count
            const questionRef = db.collection('questions').doc(answerData.questionId);
            transaction.update(questionRef, {
                answerCount: firebase.firestore.FieldValue.increment(-1)
            });
            
            // Update user stats and reputation (-1 for deleting answer)
            const userRef = db.collection('users').doc(currentUser.uid);
            transaction.update(userRef, {
                answersGiven: firebase.firestore.FieldValue.increment(-1),
                reputation: firebase.firestore.FieldValue.increment(-1)
            });
        });
        
        // Reload answers to reflect the deletion
        loadAnswers(currentQuestionId);
        
        // Update displayed reputation
        loadUserReputation();
        
        console.log('Answer deleted successfully');
        
    } catch (error) {
        console.error('Error deleting answer:', error);
        alert('Failed to delete answer: ' + error.message);
    }
}

async function submitAnswer(event) {
    event.preventDefault();
    if (!currentUser || !currentQuestionId) { return; }
    const body = document.getElementById('answer-body').value.trim();
    if (!body) { alert('Please write an answer'); return; }
    
    try {
        const answerData = {
            questionId: currentQuestionId,
            body: body,
            authorId: currentUser.uid,
            authorName: currentUser.displayName || currentUser.email,
            authorPhoto: currentUser.photoURL || '',
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            voteCount: 0,
            votes: {}
        };
        
        await db.collection('answers').add(answerData);
        
        // Update question answer count
        await db.collection('questions').doc(currentQuestionId).update({
            answerCount: firebase.firestore.FieldValue.increment(1)
        });
        
        // Update user stats and reputation (+1 for answering a question)
        await db.collection('users').doc(currentUser.uid).update({
            answersGiven: firebase.firestore.FieldValue.increment(1),
            reputation: firebase.firestore.FieldValue.increment(1)
        });
        
        document.getElementById('answer-form').reset();
        loadAnswers(currentQuestionId);
        
        // Update displayed reputation
        loadUserReputation();
    } catch (error) {
        console.error('Error posting answer:', error);
        alert('Error posting answer. Please try again.');
    }
}

// Event Listeners
function setupEventListeners() {
    // Auth
    document.getElementById('login-btn').addEventListener('click', showLoginModal);
    document.getElementById('signup-btn').addEventListener('click', showSignupModal);
    document.getElementById('close-modal-btn').addEventListener('click', closeAuthModal);
    document.getElementById('overlay').addEventListener('click', closeAuthModal);
    document.getElementById('auth-switch-link').addEventListener('click', toggleAuthMode);
    document.getElementById('google-signin-btn').addEventListener('click', signInWithGoogle);

    // Main Navigation
    document.getElementById('home-link').addEventListener('click', showHome);
    document.getElementById('ask-question-link').addEventListener('click', showAskQuestion);
    document.getElementById('ask-question-btn-main').addEventListener('click', showAskQuestion);

    // User Menu
    document.getElementById('user-info-wrapper').addEventListener('click', () => toggleUserMenu());
    document.getElementById('profile-link').addEventListener('click', showProfilePage);
    document.getElementById('logout-link').addEventListener('click', logout);
    
    // Forms
    document.getElementById('email-auth-form').addEventListener('submit', function(e) {
        e.preventDefault();
        const email = document.getElementById('auth-email').value;
        const password = document.getElementById('auth-password').value;
        signInWithEmail(email, password);
    });
    document.getElementById('ask-question-form').addEventListener('submit', submitQuestion);
    document.getElementById('answer-form').addEventListener('submit', submitAnswer);
    document.getElementById('profile-form').addEventListener('submit', updateUserProfile);
    document.getElementById('cancel-question-btn').addEventListener('click', showHome);
    document.getElementById('cancel-profile-btn').addEventListener('click', showHome);

    // Filters
    document.getElementById('filters').addEventListener('click', function(e) {
        if (e.target.matches('.filter-btn')) {
            filterQuestions(e.target.dataset.filter);
        }
    });
}

// User Menu Dropdown Logic
function toggleUserMenu(forceClose = false) {
    const dropdown = document.getElementById('user-menu-dropdown');
    if (forceClose) {
        dropdown.style.display = 'none';
        return;
    }
    dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
}

window.addEventListener('click', function(event) {
    const userMenuNode = document.getElementById('user-menu');
    if (userMenuNode && !userMenuNode.contains(event.target)) {
        toggleUserMenu(true);
    }
});

// Utility Functions
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function getTimeAgo(date) {
    if (!date) return 'Unknown time';
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);
    if (diffInSeconds < 60) return 'just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    return date.toLocaleDateString();
}

// Voting Functions - SIMPLIFIED AND FIXED
async function voteQuestion(questionId, voteValue) {
    if (!currentUser) {
        showLoginModal();
        return;
    }
    
    try {
        await db.runTransaction(async (transaction) => {
            const questionRef = db.collection('questions').doc(questionId);
            const questionDoc = await transaction.get(questionRef);
            
            if (!questionDoc.exists) {
                throw new Error("Question does not exist!");
            }
            
            const questionData = questionDoc.data();
            
            // Prevent voting on own questions
            if (questionData.authorId === currentUser.uid) {
                throw new Error("You cannot vote on your own question.");
            }
            
            const currentVote = questionData.votes[currentUser.uid] || 0;
            let newVote = voteValue === currentVote ? 0 : voteValue; // Toggle vote
            let voteChange = newVote - currentVote;
            
            // Update question
            transaction.update(questionRef, {
                voteCount: (questionData.voteCount || 0) + voteChange,
                [`votes.${currentUser.uid}`]: newVote
            });
            
            // Update author's reputation
            if (questionData.authorId && voteChange !== 0) {
                const authorRef = db.collection('users').doc(questionData.authorId);
                let repChange = 0;
                
                if (voteChange === 1) { // New upvote or changing from downvote to upvote
                    repChange = currentVote === -1 ? 8 : 5; // +8 if changing from downvote, +5 if new upvote
                } else if (voteChange === -1) { // New downvote or changing from upvote to downvote
                    repChange = currentVote === 1 ? -8 : -3; // -8 if changing from upvote, -3 if new downvote
                }
                
                if (repChange !== 0) {
                    transaction.update(authorRef, {
                        reputation: firebase.firestore.FieldValue.increment(repChange)
                    });
                }
            }
        });
        
        // Reload the question to show updated vote count
        loadQuestionDetail(questionId);
        
        // Update displayed reputation if current user's reputation changed
        if (currentUser) {
            loadUserReputation();
        }
        
    } catch (error) {
        console.error("Vote transaction failed: ", error);
        alert(error.message);
    }
}


async function voteAnswer(answerId, voteValue) {
    if (!currentUser) {
        showLoginModal();
        return;
    }
    
    try {
        await db.runTransaction(async (transaction) => {
            const answerRef = db.collection('answers').doc(answerId);
            const answerDoc = await transaction.get(answerRef);
            
            if (!answerDoc.exists) {
                throw new Error("Answer does not exist!");
            }
            
            const answerData = answerDoc.data();
            
            // Prevent voting on own answers
            if (answerData.authorId === currentUser.uid) {
                throw new Error("You cannot vote on your own answer.");
            }
            
            const currentVote = answerData.votes[currentUser.uid] || 0;
            let newVote = voteValue === currentVote ? 0 : voteValue; // Toggle vote
            let voteChange = newVote - currentVote;
            
            // Update answer
            transaction.update(answerRef, {
                voteCount: (answerData.voteCount || 0) + voteChange,
                [`votes.${currentUser.uid}`]: newVote
            });
            
            // Update author's reputation - FIXED LOGIC
            if (answerData.authorId && voteChange !== 0) {
                const authorRef = db.collection('users').doc(answerData.authorId);
                let repChange = 0;
                
                // Fixed reputation calculation logic
                if (voteChange === 1) { 
                    // Adding an upvote or changing from downvote to upvote
                    repChange = currentVote === -1 ? 8 : 5; // +8 if was downvote, +5 if new upvote
                } else if (voteChange === -1) { 
                    // Adding a downvote or changing from upvote to downvote
                    repChange = currentVote === 1 ? -8 : -3; // -8 if was upvote, -3 if new downvote
                } else if (voteChange === -1 && currentVote === 1) { 
                    // This condition is redundant and will never be reached
                    // because if voteChange is -1 and currentVote is 1, it's covered above
                    repChange = -5;
                } else if (voteChange === 1 && currentVote === -1) { 
                    // This condition is also redundant
                    repChange = 3;
                }
                
                console.log(`Reputation change for answer vote: ${repChange} (voteChange: ${voteChange}, currentVote: ${currentVote})`);
                
                if (repChange !== 0) {
                    transaction.update(authorRef, {
                        reputation: firebase.firestore.FieldValue.increment(repChange)
                    });
                }
            }
        });
        
        // Reload the answers to show updated vote count
        loadAnswers(currentQuestionId);
        
        // Update displayed reputation if current user's reputation changed
        if (currentUser) {
            loadUserReputation();
        }
        
    } catch (error) {
        console.error("Vote transaction failed: ", error);
        alert(error.message);
    }
}

function filterQuestions(filter) {
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.querySelector(`.filter-btn[data-filter="${filter}"]`);
    if (activeBtn) {
        activeBtn.classList.add('active');
    }
    loadQuestions(filter);
}
