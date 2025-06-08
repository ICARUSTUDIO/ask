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
    
    // Clear form
    document.getElementById('email-auth-form').reset();
}

function showUserMenu() {
    authButtons.style.display = 'none';
    userMenu.style.display = 'flex';
    
    // Update user info
    document.getElementById('user-name').textContent = currentUser.displayName || currentUser.email;
    document.getElementById('user-avatar').src = currentUser.photoURL || 'https://via.placeholder.com/32x32?text=U';
    
    // Load user reputation
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
                displayName: user.displayName || user.email || 'Anonymous User',
                email: user.email || '',
                photoURL: user.photoURL || '',
                reputation: 0,
                joinDate: firebase.firestore.FieldValue.serverTimestamp(),
                questionsAsked: 0,
                answersGiven: 0
            };
            
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
            const userData = userDoc.data();
            const reputation = userData.reputation || 0;
            const reputationElement = document.getElementById('user-rep');
            if (reputationElement) {
                reputationElement.textContent = reputation;
            }
            console.log('User reputation loaded:', reputation);
        } else {
            console.warn('User document does not exist, creating one...');
            await createUserDocument(currentUser);
            // Recursively call to load after creation
            await loadUserReputation();
        }
    } catch (error) {
        console.error('Error loading user reputation:', error);
        const reputationElement = document.getElementById('user-rep');
        if (reputationElement) {
            reputationElement.textContent = '0';
        }
    }
}

// Navigation Functions
function showHome() {
    homePage.style.display = 'block';
    askQuestionPage.style.display = 'none';
    questionDetailPage.style.display = 'none';
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
}

function showQuestionDetail(questionId) {
    currentQuestionId = questionId;
    homePage.style.display = 'none';
    askQuestionPage.style.display = 'none';
    questionDetailPage.style.display = 'block';
    loadQuestionDetail(questionId);
}

// Questions Functions
async function loadQuestions(filter = 'newest') {
    try {
        questionsList.innerHTML = '<div class="loading">Loading questions...</div>';
        
        let query = db.collection('questions');
        
        // Apply sorting based on filter
        switch (filter) {
            case 'votes':
                query = query.orderBy('voteCount', 'desc');
                break;
            case 'answers':
                query = query.orderBy('answerCount', 'desc');
                break;
            default: // newest
                query = query.orderBy('timestamp', 'desc');
        }
        
        const snapshot = await query.limit(20).get();
        
        if (snapshot.empty) {
            questionsList.innerHTML = '<div class="loading">No questions yet. Be the first to ask!</div>';
            return;
        }
        
        const questionsHTML = snapshot.docs.map(doc => {
            const question = doc.data();
            return createQuestionCard(doc.id, question);
        }).join('');
        
        questionsList.innerHTML = questionsHTML;
        
    } catch (error) {
        console.error('Error loading questions:', error);
        questionsList.innerHTML = '<div class="loading">Error loading questions. Please try again.</div>';
    }
}

function createQuestionCard(id, question) {
    const timeAgo = getTimeAgo(question.timestamp?.toDate());
    const excerpt = question.body.length > 150 ? 
        question.body.substring(0, 150) + '...' : question.body;
    
    return `
        <div class="question-card" onclick="showQuestionDetail('${id}')">
            <div class="question-stats">
                <div class="stat">
                    <span class="stat-number">${question.voteCount || 0}</span>
                    <span>votes</span>
                </div>
                <div class="stat">
                    <span class="stat-number">${question.answerCount || 0}</span>
                    <span>answers</span>
                </div>
            </div>
            <h3 class="question-title">${escapeHtml(question.title)}</h3>
            <p class="question-excerpt">${escapeHtml(excerpt)}</p>
            <div class="question-meta">
                <div class="question-author">
                    <img src="${question.authorPhoto || 'https://via.placeholder.com/20x20?text=U'}" 
                         alt="Author" class="author-avatar">
                    <span>${escapeHtml(question.authorName)}</span>
                </div>
                <span class="question-time">${timeAgo}</span>
            </div>
        </div>
    `;
}

async function submitQuestion(event) {
    event.preventDefault();
    
    if (!currentUser) {
        showLoginModal();
        return;
    }
    
    const title = document.getElementById('question-title').value.trim();
    const body = document.getElementById('question-body').value.trim();
    
    if (!title || !body) {
        alert('Please fill in both title and body');
        return;
    }
    
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
        
        // Update user's question count
        await db.collection('users').doc(currentUser.uid).update({
            questionsAsked: firebase.firestore.FieldValue.increment(1)
        });
        
        console.log('Question posted:', docRef.id);
        
        // Clear form and redirect
        document.getElementById('ask-question-form').reset();
        showQuestionDetail(docRef.id);
        
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
        
        const questionHTML = `
            <div class="question-header">
                <h1>${escapeHtml(question.title)}</h1>
                <div class="question-meta">
                    <span>Asked ${timeAgo} by ${escapeHtml(question.authorName)}</span>
                </div>
            </div>
            <div style="display: flex; align-items: flex-start; gap: 20px;">
                <div class="question-votes">
                    <button class="vote-btn" onclick="voteQuestion('${questionId}', 1)" 
                            ${!currentUser ? 'disabled' : ''}>▲</button>
                    <span class="vote-count">${question.voteCount || 0}</span>
                    <button class="vote-btn" onclick="voteQuestion('${questionId}', -1)" 
                            ${!currentUser ? 'disabled' : ''}>▼</button>
                </div>
                <div style="flex: 1;">
                    <div class="question-body">
                        ${escapeHtml(question.body).replace(/\n/g, '<br>')}
                    </div>
                </div>
            </div>
        `;
        
        document.getElementById('question-detail').innerHTML = questionHTML;
        
        // Load answers
        loadAnswers(questionId);
        
        // Show/hide answer form based on authentication
        const answerFormSection = document.getElementById('answer-form-section');
        if (currentUser) {
            answerFormSection.style.display = 'block';
        } else {
            answerFormSection.style.display = 'none';
        }
        
    } catch (error) {
        console.error('Error loading question detail:', error);
        document.getElementById('question-detail').innerHTML = '<p>Error loading question.</p>';
    }
}

async function loadAnswers(questionId) {
    try {
        console.log('Loading answers for question:', questionId);
        
        const answersSnapshot = await db.collection('answers')
            .where('questionId', '==', questionId)
            .get();
        
        const answerCount = answersSnapshot.size;
        
        // Safely update answers count
        const answersCountElement = document.getElementById('answers-count');
        if (answersCountElement) {
            answersCountElement.textContent = `${answerCount} Answer${answerCount !== 1 ? 's' : ''}`;
        }
        
        const answersListElement = document.getElementById('answers-list');
        if (!answersListElement) {
            console.warn('answers-list element not found');
            return;
        }
        
        if (answerCount === 0) {
            answersListElement.innerHTML = '<p class="text-muted">No answers yet. Be the first to answer!</p>';
            return;
        }
        
        // Get all answers and sort them manually with better error handling
        const answersData = answersSnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                // Ensure required fields have default values
                voteCount: typeof data.voteCount === 'number' ? data.voteCount : 0,
                timestamp: data.timestamp || null,
                authorName: data.authorName || 'Anonymous',
                authorPhoto: data.authorPhoto || 'https://via.placeholder.com/20x20?text=U',
                body: data.body || ''
            };
        });
        
        // Sort by votes (descending) then by timestamp (ascending)
        answersData.sort((a, b) => {
            const aVotes = a.voteCount || 0;
            const bVotes = b.voteCount || 0;
            
            if (bVotes !== aVotes) {
                return bVotes - aVotes; // Higher votes first
            }
            
            // If votes are equal, sort by timestamp (older first)
            const aTime = a.timestamp?.toDate?.()?.getTime() || 0;
            const bTime = b.timestamp?.toDate?.()?.getTime() || 0;
            return aTime - bTime;
        });
        
        const answersHTML = answersData.map(answer => {
            // Safe timestamp handling
            let timeAgo = 'Unknown time';
            try {
                if (answer.timestamp && typeof answer.timestamp.toDate === 'function') {
                    timeAgo = getTimeAgo(answer.timestamp.toDate());
                }
            } catch (timeError) {
                console.warn('Error parsing timestamp for answer:', answer.id, timeError);
                timeAgo = 'Some time ago';
            }
            
            // Ensure we have valid data before rendering
            const safeBody = answer.body ? escapeHtml(answer.body).replace(/\n/g, '<br>') : 'No content';
            const safeAuthorName = answer.authorName ? escapeHtml(answer.authorName) : 'Anonymous';
            
            return `
                <div class="answer-card">
                    <div style="display: flex; align-items: flex-start; gap: 20px;">
                        <div class="question-votes">
                            <button class="vote-btn" onclick="voteAnswer('${answer.id}', 1)" 
                                    ${!currentUser ? 'disabled' : ''}>▲</button>
                            <span class="vote-count">${answer.voteCount}</span>
                            <button class="vote-btn" onclick="voteAnswer('${answer.id}', -1)" 
                                    ${!currentUser ? 'disabled' : ''}>▼</button>
                        </div>
                        <div style="flex: 1;">
                            <div class="answer-body">
                                ${safeBody}
                            </div>
                            <div class="question-meta mt-20">
                                <div class="question-author">
                                    <img src="${answer.authorPhoto}" 
                                         alt="Author" class="author-avatar">
                                    <span>${safeAuthorName}</span>
                                </div>
                                <span>${timeAgo}</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
        answersListElement.innerHTML = answersHTML;
        
    } catch (error) {
        console.error('Error loading answers:', error);
        
        const answersListElement = document.getElementById('answers-list');
        if (answersListElement) {
            // More specific error handling
            let errorMessage = 'Error loading answers';
            if (error.code === 'permission-denied') {
                errorMessage = 'Permission denied loading answers';
            } else if (error.code === 'unavailable') {
                errorMessage = 'Service temporarily unavailable';
            }
            
            answersListElement.innerHTML = `
                <p style="color: #c33; padding: 20px; background: #fee; border-radius: 4px;">
                    ${errorMessage}: ${error.message}
                    <br><button onclick="loadAnswers('${questionId}')" class="btn btn-outline" style="margin-top: 10px;">Try Again</button>
                </p>
            `;
        }
        
        // Re-throw error to let calling function know it failed
        throw error;
    }
}
async function submitAnswer(event) {
    event.preventDefault();
    
    if (!currentUser || !currentQuestionId) {
        return;
    }
    
    const body = document.getElementById('answer-body').value.trim();
    
    if (!body) {
        alert('Please write an answer');
        return;
    }
    
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
        
        // Update question's answer count
        await db.collection('questions').doc(currentQuestionId).update({
            answerCount: firebase.firestore.FieldValue.increment(1)
        });
        
        // Update user's answer count
        await db.collection('users').doc(currentUser.uid).update({
            answersGiven: firebase.firestore.FieldValue.increment(1)
        });
        
        // Clear form and reload answers
        document.getElementById('answer-form').reset();
        loadAnswers(currentQuestionId);
        
        console.log('Answer posted successfully');
        
    } catch (error) {
        console.error('Error posting answer:', error);
        alert('Error posting answer. Please try again.');
    }
}

// Voting Functions
async function voteQuestion(questionId, voteValue) {
    if (!currentUser) {
        showLoginModal();
        return;
    }
    
    try {
        await vote('questions', questionId, voteValue);
        // Reload question detail only if vote succeeded
        await loadQuestionDetail(questionId);
    } catch (error) {
        console.error('Error voting on question:', error);
        // vote() function already shows appropriate error message
    }
}

async function voteAnswer(answerId, voteValue) {
    if (!currentUser) {
        showLoginModal();
        return;
    }
    
    try {
        // Only proceed with reload if vote succeeds
        await vote('answers', answerId, voteValue);
        
        // Reload answers - but handle failure gracefully
        try {
            await loadAnswers(currentQuestionId);
        } catch (loadError) {
            console.error('Failed to reload answers after successful vote:', loadError);
            // Vote succeeded but reload failed - show a different message
            alert('Vote recorded successfully, but failed to refresh the page. Please reload manually.');
        }
        
    } catch (voteError) {
        console.error('Error voting on answer:', voteError);
        // vote() function already handles and shows the error message
        // Don't show additional alert here
    }
}

async function updateAuthorReputation(itemData, oldVote, newVote, collection) {
    // Skip if no author or if user is voting on their own content
    if (!itemData.authorId || itemData.authorId === currentUser.uid) {
        return;
    }
    
    const reputationChange = (newVote - oldVote) * (collection === 'questions' ? 5 : 10);
    
    // Skip if no reputation change
    if (reputationChange === 0) {
        return;
    }
    
    try {
        const userRef = db.collection('users').doc(itemData.authorId);
        
        // Use a transaction to ensure data consistency
        await db.runTransaction(async (transaction) => {
            const userDoc = await transaction.get(userRef);
            
            if (!userDoc.exists) {
                console.warn('Author user document does not exist:', itemData.authorId);
                // Create user document if it doesn't exist
                await transaction.set(userRef, {
                    displayName: 'Unknown User',
                    email: '',
                    photoURL: '',
                    reputation: Math.max(0, reputationChange), // Don't allow negative reputation
                    joinDate: firebase.firestore.FieldValue.serverTimestamp(),
                    questionsAsked: 0,
                    answersGiven: 0
                });
                console.log('Created missing user document with reputation:', reputationChange);
            } else {
                const currentReputation = userDoc.data().reputation || 0;
                const newReputation = Math.max(0, currentReputation + reputationChange); // Don't allow negative reputation
                
                await transaction.update(userRef, {
                    reputation: newReputation
                });
                console.log(`Reputation updated: ${currentReputation} -> ${newReputation} (change: ${reputationChange})`);
            }
        });
        
    } catch (reputationError) {
        // Log reputation error but don't fail the vote
        console.error('Error updating reputation (vote still succeeded):', reputationError);
        
        // Optionally show a non-blocking notification about reputation update failure
        if (reputationError.code === 'permission-denied') {
            console.warn('Permission denied when updating reputation - check Firestore rules');
        }
    }
}


async function vote(collection, documentId, voteValue) {
    if (!currentUser) {
        showLoginModal();
        return;
    }
    
    try {
        const docRef = db.collection(collection).doc(documentId);
        const doc = await docRef.get();
        
        if (!doc.exists) {
            throw new Error('Content no longer exists');
        }
        
        const data = doc.data();
        const votes = data.votes || {};
        const currentVote = votes[currentUser.uid] || 0;
        
        // Calculate new vote
        let newVote = 0;
        if (currentVote === voteValue) {
            // User is removing their vote
            newVote = 0;
        } else {
            // User is voting or changing vote
            newVote = voteValue;
        }
        
        // Update votes object
        const updatedVotes = { ...votes };
        if (newVote === 0) {
            delete updatedVotes[currentUser.uid];
        } else {
            updatedVotes[currentUser.uid] = newVote;
        }
        
        // Calculate new vote count
        const newVoteCount = Object.values(updatedVotes).reduce((sum, vote) => sum + vote, 0);
        
        // Update document with vote data
        await docRef.update({
            votes: updatedVotes,
            voteCount: newVoteCount
        });
        
        console.log('Vote updated successfully');
        
        // Update author's reputation - improved error handling
        await updateAuthorReputation(data, currentVote, newVote, collection);
        
    } catch (error) {
        console.error('Error voting:', error);
        
        // Provide more specific error messages
        let errorMessage = 'Error submitting vote. Please try again.';
        
        if (error.code === 'permission-denied') {
            errorMessage = 'You do not have permission to vote on this item.';
        } else if (error.code === 'not-found') {
            errorMessage = 'The item you are trying to vote on no longer exists.';
        } else if (error.code === 'unavailable') {
            errorMessage = 'Service temporarily unavailable. Please try again.';
        } else if (error.message === 'Content no longer exists') {
            errorMessage = 'This content has been deleted.';
        }
        
        alert(errorMessage);
        throw error; // Re-throw to allow calling functions to handle if needed
    }
}

// Filter Functions
function filterQuestions(filter) {
    // Update active filter button
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    
    loadQuestions(filter);
}

// Event Listeners
function setupEventListeners() {
    // Google Sign-in
    document.getElementById('google-signin-btn').addEventListener('click', signInWithGoogle);
    
    // Email/Password Form
    document.getElementById('email-auth-form').addEventListener('submit', function(e) {
        e.preventDefault();
        const email = document.getElementById('auth-email').value;
        const password = document.getElementById('auth-password').value;
        signInWithEmail(email, password);
    });
    
    // Ask Question Form
    document.getElementById('ask-question-form').addEventListener('submit', submitQuestion);
    
    // Answer Form
    document.getElementById('answer-form').addEventListener('submit', submitAnswer);
}

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
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)} days ago`;
    
    return date.toLocaleDateString();
}
