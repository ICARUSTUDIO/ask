// Global Variables
let currentUser = null;
let currentQuestionId = null;
let isSignupMode = false;
let confirmCallback = null; // For the custom confirm modal
let notificationsListener = null; // To store the unsubscribe function for notifications

// DOM Elements
const authButtons = document.getElementById('auth-buttons');
const userMenu = document.getElementById('user-menu');
const authModal = document.getElementById('auth-modal');
const confirmModal = document.getElementById('confirm-modal');
const overlay = document.getElementById('overlay');
const questionsList = document.getElementById('questions-list');
const alertContainer = document.getElementById('alert-container');
const notificationsContainer = document.getElementById('notifications-container');
const notificationsBell = document.getElementById('notifications-bell');
const notificationsCount = document.getElementById('notifications-count');
const notificationsDropdown = document.getElementById('notifications-dropdown');


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
            listenForNotifications(); // Start listening for notifications
        } else {
            currentUser = null;
            showAuthButtons();
            listenForNotifications(); // Stop listening and hide UI
        }
        // Reload content that depends on auth state
        if(currentQuestionId) {
            loadQuestionDetail(currentQuestionId);
        }
    });
    
    // Load initial questions
    loadQuestions();
    
    // Setup event listeners
    setupEventListeners();
});

// --- Alert/Notification Functions ---
function showAlert(message, type = 'error', duration = 3000) {
    const alertElement = document.createElement('div');
    alertElement.className = `alert alert-${type}`;
    alertElement.textContent = message;
    
    alertContainer.appendChild(alertElement);
    
    // Animate in
    setTimeout(() => {
        alertElement.classList.add('show');
    }, 10);

    // Animate out and remove
    setTimeout(() => {
        alertElement.classList.remove('show');
        alertElement.addEventListener('transitionend', () => {
            alertElement.remove();
        });
    }, duration);
}


// --- Modal Functions ---

function showModal(modalElement) {
    modalElement.style.display = 'flex';
    overlay.style.display = 'block';
    document.body.style.overflow = 'hidden';
}

function closeModal(modalElement) {
    modalElement.style.display = 'none';
    overlay.style.display = 'none';
    document.body.style.overflow = 'auto';
}

function showLoginModal() {
    isSignupMode = false;
    document.getElementById('auth-modal-title').textContent = 'Login';
    document.getElementById('auth-submit-btn').textContent = 'Login';
    document.getElementById('auth-switch-text').textContent = "Don't have an account?";
    document.getElementById('auth-switch-link').textContent = 'Sign up';
    showModal(authModal);
}

function showSignupModal() {
    isSignupMode = true;
    document.getElementById('auth-modal-title').textContent = 'Sign Up';
    document.getElementById('auth-submit-btn').textContent = 'Sign Up';
    document.getElementById('auth-switch-text').textContent = 'Already have an account?';
    document.getElementById('auth-switch-link').textContent = 'Login';
    showModal(authModal);
}

function closeAuthModal() {
    closeModal(authModal);
    document.getElementById('email-auth-form').reset();
}

// Reusable confirmation modal
function showConfirmModal(text, onConfirm) {
    document.getElementById('confirm-modal-text').textContent = text;
    confirmCallback = onConfirm;
    showModal(confirmModal);
}

function closeConfirmModal() {
    closeModal(confirmModal);
    confirmCallback = null;
}


// --- Authentication & User Functions ---

function toggleAuthMode() {
    if (isSignupMode) {
        showLoginModal();
    } else {
        showSignupModal();
    }
}

function showUserMenu() {
    authButtons.style.display = 'none';
    userMenu.style.display = 'block';
    notificationsContainer.style.display = 'block'; // Show notifications bell
    
    document.getElementById('user-name').textContent = currentUser.displayName || currentUser.email.split('@')[0];
    document.getElementById('user-avatar').src = currentUser.photoURL || `https://ui-avatars.com/api/?name=${currentUser.displayName || currentUser.email}&background=random`;
    
    loadUserReputation();
}

function showAuthButtons() {
    authButtons.style.display = 'flex';
    userMenu.style.display = 'none';
    notificationsContainer.style.display = 'none'; // Hide notifications bell
}

async function signInWithGoogle() {
    try {
        const result = await auth.signInWithPopup(googleProvider);
        showAlert(`Welcome, ${result.user.displayName}!`, 'success');
        closeAuthModal();
    } catch (error) {
        console.error('Google sign-in error:', error);
        showAlert('Google sign-in failed. Please try again.');
    }
}

async function signInWithEmail(email, password) {
    try {
        if (isSignupMode) {
            await auth.createUserWithEmailAndPassword(email, password);
             showAlert('Account created successfully! Welcome.', 'success');
        } else {
            await auth.signInWithEmailAndPassword(email, password);
            showAlert('Logged in successfully!', 'success');
        }
        closeAuthModal();
    } catch (error) {
        console.error('Email auth error:', error);
        showAlert(getFriendlyAuthError(error));
    }
}

async function logout() {
    try {
        await auth.signOut();
        showHome();
        showAlert('You have been logged out.', 'success');
        console.log('User signed out');
    } catch (error) {
        console.error('Logout error:', error);
        showAlert('Error logging out. Please try again.');
    }
}

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
        }
    } catch (error) {
        console.error('Error creating user document:', error);
        showAlert('There was an issue setting up your account.');
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


// --- Navigation Functions ---
function showPage(pageElement) {
    [homePage, askQuestionPage, questionDetailPage, profilePage].forEach(page => {
        page.style.display = 'none';
    });
    pageElement.style.display = 'block';
}

function showHome() {
    showPage(homePage);
    currentQuestionId = null;
    loadQuestions();
}

function showAskQuestion() {
    if (!currentUser) { 
        showAlert('Please log in to ask a question.');
        showLoginModal(); 
        return; 
    }
    showPage(askQuestionPage);
    fetchAllUsers(); // Fetch users for mention suggestions
}

function showQuestionDetail(questionId) {
    currentQuestionId = questionId;
    showPage(questionDetailPage);
    loadQuestionDetail(questionId);
}

function showProfilePage() {
    if (!currentUser) { 
        showAlert('Please log in to view your profile.');
        showLoginModal();
        return; 
    }
    showPage(profilePage);
    toggleUserMenu(true); // Close dropdown
    loadProfileData();
}


// --- Profile Page Functions ---
async function loadProfileData() {
    if (!currentUser) return;
    document.getElementById('profile-email').value = currentUser.email || '';
    
    try {
        const userDoc = await db.collection('users').doc(currentUser.uid).get();
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
        showAlert('Could not load your profile information.');
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
        showAlert('Please provide at least a first or last name.'); 
        return; 
    }

    try {
        await currentUser.updateProfile({ displayName: newDisplayName, photoURL: photoURL });
        await db.collection('users').doc(currentUser.uid).update({
            firstName, lastName, displayName: newDisplayName, photoURL
        });

        currentUser = auth.currentUser; // Re-fetch to get updated values
        showUserMenu();
        showHome();
        showAlert('Profile updated successfully!', 'success');
    } catch (error) {
        console.error('Error updating profile:', error);
        showAlert('Failed to update profile. Please try again.');
    }
}

// --- Mention/Tagging Feature ---

let allUsers = []; // Cache for user data
let mentionsPopup;
let questionBodyTextarea;
let currentMentionTerm = null; // The text after '@' we are searching for
let activeMentionIndex = -1;
let mentionStartIndex = -1; // Position of '@' in the textarea

async function fetchAllUsers() {
    if (allUsers.length > 0) return; // Don't re-fetch if already populated
    try {
        const snapshot = await db.collection('users').get();
        allUsers = snapshot.docs.map(doc => ({
            id: doc.id,
            displayName: doc.data().displayName,
            reputation: doc.data().reputation || 0,
            photoURL: doc.data().photoURL || `https://ui-avatars.com/api/?name=${doc.data().displayName}&background=random`
        }));
        // Sort by reputation to show high-rep users first in suggestions
        allUsers.sort((a, b) => (b.reputation || 0) - (a.reputation || 0));
        console.log(`Fetched ${allUsers.length} users for tagging.`);
    } catch (error) {
        console.error('Error fetching users for mentions:', error);
    }
}

function handleMentionInput(e) {
    const textarea = e.target;
    const cursorPos = textarea.selectionStart;
    const textBeforeCursor = textarea.value.substring(0, cursorPos);
    const mentionMatch = textBeforeCursor.match(/@([\w\s.-]*)$/);

    if (mentionMatch) {
        mentionStartIndex = mentionMatch.index;
        currentMentionTerm = mentionMatch[1].toLowerCase();
        
        const filteredUsers = allUsers.filter(user =>
            user.displayName && user.displayName.toLowerCase().includes(currentMentionTerm)
        );

        if (filteredUsers.length > 0) {
            showMentionsPopup(filteredUsers, textarea);
        } else {
            hideMentionsPopup();
        }
    } else {
        hideMentionsPopup();
    }
}

function showMentionsPopup(users, textarea) {
    const rect = textarea.getBoundingClientRect();
    mentionsPopup.style.left = `${rect.left}px`;
    mentionsPopup.style.top = `${rect.bottom + window.scrollY}px`;
    
    mentionsPopup.innerHTML = users.slice(0, 5).map((user, index) => `
        <div class="mention-item" data-username="${escapeHtml(user.displayName)}" data-index="${index}">
            <img src="${user.photoURL}" alt="${escapeHtml(user.displayName)}">
            <span class="mention-name">${escapeHtml(user.displayName)}</span>
            <span class="mention-rep">${user.reputation} rep</span>
        </div>
    `).join('');

    mentionsPopup.style.display = 'block';
    activeMentionIndex = -1;

    mentionsPopup.querySelectorAll('.mention-item').forEach(item => {
        item.addEventListener('click', () => {
            selectMention(item.dataset.username);
        });
    });
}

function hideMentionsPopup() {
    if (mentionsPopup && mentionsPopup.style.display === 'block') {
        mentionsPopup.style.display = 'none';
        currentMentionTerm = null;
        activeMentionIndex = -1;
        mentionStartIndex = -1;
    }
}

function selectMention(username) {
    const textarea = questionBodyTextarea;
    const text = textarea.value;
    const textBefore = text.substring(0, mentionStartIndex);
    const textAfter = text.substring(textarea.selectionStart);
    
    textarea.value = `${textBefore}@${username} ${textAfter}`;
    
    hideMentionsPopup();
    textarea.focus();
    const newCursorPos = textBefore.length + username.length + 2;
    textarea.setSelectionRange(newCursorPos, newCursorPos);
}

function handleMentionKeyDown(e) {
    if (!mentionsPopup || mentionsPopup.style.display !== 'block') return;

    const items = mentionsPopup.querySelectorAll('.mention-item');
    if (items.length === 0) return;

    switch (e.key) {
        case 'ArrowDown':
            e.preventDefault();
            activeMentionIndex = (activeMentionIndex + 1) % items.length;
            updateMentionSelection(items);
            break;
        case 'ArrowUp':
            e.preventDefault();
            activeMentionIndex = (activeMentionIndex - 1 + items.length) % items.length;
            updateMentionSelection(items);
            break;
        case 'Enter':
        case 'Tab':
            if (activeMentionIndex > -1) {
                e.preventDefault();
                selectMention(items[activeMentionIndex].dataset.username);
            }
            break;
        case 'Escape':
            e.preventDefault();
            hideMentionsPopup();
            break;
    }
}

function updateMentionSelection(items) {
    items.forEach((item, index) => {
        item.classList.toggle('selected', index === activeMentionIndex);
    });
}

function parseMentions(body) {
    const taggedUids = new Set();
    let highlightedBody = escapeHtml(body); 

    if (allUsers.length === 0) {
        return { taggedUids: [], highlightedBody: highlightedBody };
    }

    const sortedUsers = [...allUsers].sort((a, b) => (b.displayName?.length || 0) - (a.displayName?.length || 0));

    sortedUsers.forEach(user => {
        if (!user.displayName) return; 

        const mentionRegex = new RegExp(`@${escapeRegex(user.displayName)}`, 'g');
        
        if (body.match(mentionRegex)) {
            if (user.id !== currentUser.uid) {
                taggedUids.add(user.id);
            }
            highlightedBody = highlightedBody.replace(mentionRegex, `<span class="mention-highlight">@${escapeHtml(user.displayName)}</span>`);
        }
    });

    return { taggedUids: Array.from(taggedUids), highlightedBody };
}

function escapeRegex(string) {
    return string.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
}


// --- Questions, Answers, Replies ---

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
        questionsList.innerHTML = snapshot.docs.map(doc => createQuestionCard(doc.id, doc.data())).join('');
    } catch (error) {
        console.error('Error loading questions:', error);
        questionsList.innerHTML = '<div class="loading">Error loading questions.</div>';
        showAlert('Could not load questions.');
    }
}

function createQuestionCard(id, question) {
    const timeAgo = getTimeAgo(question.timestamp?.toDate());
    const bodyForExcerpt = question.rawBody || question.body;
    const excerpt = bodyForExcerpt.length > 150 ? bodyForExcerpt.substring(0, 150) + '...' : bodyForExcerpt;
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
    if (!title || !body) { 
        showAlert('Please fill in both title and details for your question.');
        return; 
    }
    
    if (allUsers.length === 0) {
        await fetchAllUsers();
    }

    const { taggedUids, highlightedBody } = parseMentions(body);

    try {
        const docRef = await db.collection('questions').add({
            title, 
            body: highlightedBody,
            rawBody: body,
            authorId: currentUser.uid,
            authorName: currentUser.displayName || currentUser.email.split('@')[0],
            authorPhoto: currentUser.photoURL || '',
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            voteCount: 0, 
            answerCount: 0, 
            votes: {},
            taggedUids: taggedUids
        });

        // Create notifications for tagged users
        if (taggedUids.length > 0) {
            const batch = db.batch();
            taggedUids.forEach(uid => {
                const notificationRef = db.collection('notifications').doc();
                batch.set(notificationRef, {
                    recipientId: uid,
                    senderName: currentUser.displayName || currentUser.email.split('@')[0],
                    questionId: docRef.id,
                    questionTitle: title,
                    type: 'mention',
                    isRead: false,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp()
                });
            });
            await batch.commit();
        }
        
        await db.collection('users').doc(currentUser.uid).update({
            questionsAsked: firebase.firestore.FieldValue.increment(1),
            reputation: firebase.firestore.FieldValue.increment(1)
        });
        
        document.getElementById('ask-question-form').reset();
        showQuestionDetail(docRef.id);
        loadUserReputation();
        showAlert('Question posted successfully!', 'success');
    } catch (error) {
        console.error('ERROR during question submission or notification creation:', error);
        showAlert('Could not post your question. Please try again.');
    }
}

async function loadQuestionDetail(questionId) {
    try {
        const questionDoc = await db.collection('questions').doc(questionId).get();
        if (!questionDoc.exists) {
            document.getElementById('question-detail').innerHTML = '<p>Question not found.</p>';
            showAlert('This question could not be found.');
            return;
        }
        const question = questionDoc.data();
        const timeAgo = getTimeAgo(question.timestamp?.toDate());
        const isQuestionAuthor = currentUser && question.authorId === currentUser.uid;
        
        const canDelete = isQuestionAuthor && (question.answerCount || 0) === 0;
        const deleteButtonHtml = `
            <button 
                class="btn btn-danger" 
                onclick="deleteQuestion('${questionId}')"
                ${!canDelete ? 'disabled title="Can only delete questions with no answers."' : 'title="Delete this question"'}
            >
                Delete Question
            </button>
        `;
        
        document.getElementById('question-detail').innerHTML = `
            <div class="question-header">
                <h1>${escapeHtml(question.title)}</h1>
                <div class="question-meta-actions">
                     <div class="question-meta"><span>Asked ${timeAgo} by ${escapeHtml(question.authorName)}</span></div>
                     ${isQuestionAuthor ? deleteButtonHtml : ''}
                </div>
            </div>
            <div class="vote-body-wrapper">
                <div class="question-votes">
                    <button class="vote-btn" onclick="voteQuestion('${questionId}', 1)" ${!currentUser || isQuestionAuthor ? 'disabled' : ''}>▲</button>
                    <span class="vote-count">${question.voteCount || 0}</span>
                    <button class="vote-btn" onclick="voteQuestion('${questionId}', -1)" ${!currentUser || isQuestionAuthor ? 'disabled' : ''}>▼</button>
                </div>
                <div class="content-body">
                    <div class="question-body">${question.body.replace(/\n/g, '<br>')}</div>
                </div>
            </div>`;
            
        loadAnswers(questionId);
        document.getElementById('answer-form-section').style.display = currentUser ? 'block' : 'none';
    } catch (error) {
        console.error('Error loading question detail:', error);
        showAlert('Failed to load question details.');
    }
}

async function deleteQuestion(questionId) {
    if (!currentUser) {
        showAlert("You must be logged in to delete a question.");
        showLoginModal();
        return;
    }

    showConfirmModal("Are you sure you want to delete this question? This action cannot be undone.", async () => {
        const questionRef = db.collection('questions').doc(questionId);
        const userRef = db.collection('users').doc(currentUser.uid);

        try {
            await db.runTransaction(async (transaction) => {
                const questionDoc = await transaction.get(questionRef);

                if (!questionDoc.exists) {
                    throw new Error("Question not found.");
                }

                const question = questionDoc.data();

                if (question.authorId !== currentUser.uid) {
                    throw new Error("You don't have permission to delete this question.");
                }

                if ((question.answerCount || 0) > 0) {
                    throw new Error("Cannot delete a question that has answers.");
                }

                transaction.delete(questionRef);
                transaction.update(userRef, {
                    questionsAsked: firebase.firestore.FieldValue.increment(-1),
                    reputation: firebase.firestore.FieldValue.increment(-1)
                });
            });

            showAlert("Question deleted successfully.", "success");
            showHome();
            loadUserReputation();

        } catch (error) {
            console.error("Error deleting question:", error);
            if (error.message.includes("permission")) {
                 showAlert("You do not have permission to perform this action.");
            } else if (error.message.includes("answers")) {
                 showAlert(error.message);
                 loadQuestionDetail(questionId);
            } else {
                 showAlert("Failed to delete the question. Please try again.");
            }
        }
    });
}


async function loadAnswers(questionId) {
    try {
        const answersSnapshot = await db.collection('answers').where('questionId', '==', questionId).get();
        const answerCount = answersSnapshot.size;
        document.getElementById('answers-count').textContent = `${answerCount} Answer${answerCount !== 1 ? 's' : ''}`;
        
        const answersListElement = document.getElementById('answers-list');
        if (answerCount === 0) {
            answersListElement.innerHTML = '<p>No answers yet. Be the first to answer!</p>';
            return;
        }
        
        const answersData = answersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        answersData.sort((a, b) => (b.voteCount || 0) - (a.voteCount || 0));
        
        answersListElement.innerHTML = await Promise.all(answersData.map(createAnswerCard)).then(cards => cards.join(''));
        
        answersData.forEach(answer => loadReplies(answer.id));

    } catch (error) {
        console.error('Error loading answers:', error);
        showAlert('Failed to load answers.');
    }
}

async function createAnswerCard(answer) {
    const timeAgo = getTimeAgo(answer.timestamp?.toDate());
    const authorPhoto = answer.authorPhoto || `https://ui-avatars.com/api/?name=${answer.authorName}&background=random`;
    const isAuthor = currentUser && answer.authorId === currentUser.uid;

    const deleteButton = isAuthor ? `
        <button class="delete-btn" onclick="deleteAnswer('${answer.id}')" title="Delete answer">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
        </button>` : '';
    
    const replyButton = currentUser ? `
        <button class="reply-button" onclick="toggleReplyForm('${answer.id}')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
            <span>Reply</span>
        </button>` : '';

    return `
        <div class="answer-card" id="answer-${answer.id}">
            <div class="vote-body-wrapper">
                <div class="question-votes">
                    <button class="vote-btn" onclick="voteAnswer('${answer.id}', 1)" ${!currentUser || isAuthor ? 'disabled' : ''}>▲</button>
                    <span class="vote-count">${answer.voteCount || 0}</span>
                    <button class="vote-btn" onclick="voteAnswer('${answer.id}', -1)" ${!currentUser || isAuthor ? 'disabled' : ''}>▼</button>
                </div>
                <div class="content-body">
                    <div class="answer-body">${escapeHtml(answer.body).replace(/\n/g, '<br>')}</div>
                    <div class="question-meta">
                        <div class="question-author">
                            <img src="${authorPhoto}" alt="Author" class="author-avatar">
                            <span>${escapeHtml(answer.authorName)}</span>
                        </div>
                        <span>${timeAgo}</span>
                    </div>
                    <div class="answer-actions">
                        ${replyButton}
                        ${deleteButton}
                    </div>
                </div>
            </div>
            <div class="replies-container" id="replies-for-${answer.id}">
                <div class="replies-list"></div>
            </div>
        </div>`;
}

async function loadReplies(answerId) {
    const repliesContainer = document.getElementById(`replies-for-${answerId}`);
    if (!repliesContainer) return;
    const repliesList = repliesContainer.querySelector('.replies-list');

    try {
        const repliesSnapshot = await db.collection('replies').where('answerId', '==', answerId).get();
        const replies = repliesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        replies.sort((a, b) => (a.timestamp?.toDate?.() || 0) - (b.timestamp?.toDate?.() || 0));

        repliesList.innerHTML = replies.map(reply => {
            const timeAgo = getTimeAgo(reply.timestamp?.toDate?.());
            const authorPhoto = reply.authorPhoto || `https://ui-avatars.com/api/?name=${reply.authorName}&background=random`;
            const isReplyAuthor = currentUser && reply.authorId === currentUser.uid;
            
            const deleteButton = isReplyAuthor ? `
                <button class="delete-reply-btn" onclick="deleteReply('${reply.id}', '${answerId}')" title="Delete reply">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                </button>` : '';
            
            return `
                <div class="reply-card" id="reply-${reply.id}">
                    <div class="reply-meta">
                        <img src="${authorPhoto}" alt="Author" class="author-avatar" style="width:24px; height:24px;">
                        <span class="reply-author">${escapeHtml(reply.authorName)}</span>
                        <span class="reply-time">${timeAgo}</span>
                        ${deleteButton}
                    </div>
                    <div class="reply-body">${escapeHtml(reply.body)}</div>
                </div>`;
        }).join('');
    } catch (error) {
        console.error('Error loading replies:', error);
        showAlert('Could not load replies for an answer.');
    }
}

function toggleReplyForm(answerId) {
    if (!currentUser) { showLoginModal(); return; }
    
    const container = document.getElementById(`replies-for-${answerId}`);
    let form = container.querySelector('.reply-form');

    if (form) {
        form.remove();
    } else {
        form = document.createElement('form');
        form.className = 'reply-form';
        form.onsubmit = (e) => submitReply(e, answerId);
        form.innerHTML = `
            <textarea rows="2" placeholder="Add a reply..." required></textarea>
            <button type="submit" class="btn btn-primary btn-sm">Submit</button>
        `;
        container.appendChild(form);
        form.querySelector('textarea').focus();
    }
}

async function deleteReply(replyId, answerId) {
    if (!currentUser) { showLoginModal(); return; }
    
    showConfirmModal('Are you sure you want to delete this reply?', async () => {
        try {
            const replyRef = db.collection('replies').doc(replyId);
            const replyDoc = await replyRef.get();
            if (!replyDoc.exists || replyDoc.data().authorId !== currentUser.uid) {
                showAlert("You don't have permission to delete this reply.");
                return;
            }
            
            await replyRef.delete();
            await db.collection('users').doc(currentUser.uid).update({
                reputation: firebase.firestore.FieldValue.increment(-1)
            });
            
            await loadReplies(answerId);
            loadUserReputation();
            showAlert('Reply deleted.', 'success');
        } catch (error) {
            console.error('Error deleting reply:', error);
            showAlert('Failed to delete reply.');
        }
    });
}


async function submitReply(event, answerId) {
    event.preventDefault();
    if (!currentUser) { showLoginModal(); return; }

    const form = event.target;
    const textarea = form.querySelector('textarea');
    const body = textarea.value.trim();
    if (!body) { return; }
    
    form.querySelector('button').disabled = true;

    try {
        await db.collection('replies').add({
            answerId, questionId: currentQuestionId, body,
            authorId: currentUser.uid,
            authorName: currentUser.displayName || currentUser.email.split('@')[0],
            authorPhoto: currentUser.photoURL || '',
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        await db.collection('users').doc(currentUser.uid).update({
            reputation: firebase.firestore.FieldValue.increment(1)
        });
        
        form.remove();
        await loadReplies(answerId);
        loadUserReputation();
    } catch (error) {
        console.error('Error submitting reply:', error);
        showAlert('Could not post your reply.');
        form.querySelector('button').disabled = false;
    }
}

async function deleteAnswer(answerId) {
    if (!currentUser) { showLoginModal(); return; }
    
    showConfirmModal('Are you sure you want to delete this answer? All its replies will also be removed.', async () => {
        try {
            const answerRef = db.collection('answers').doc(answerId);
            const answerDoc = await answerRef.get();
            if (!answerDoc.exists || answerDoc.data().authorId !== currentUser.uid) {
                 showAlert("You don't have permission to delete this answer.");
                return;
            }
            
            const batch = db.batch();
            batch.delete(answerRef);

            const questionRef = db.collection('questions').doc(answerDoc.data().questionId);
            batch.update(questionRef, { answerCount: firebase.firestore.FieldValue.increment(-1) });
            
            const userRef = db.collection('users').doc(currentUser.uid);
            batch.update(userRef, {
                answersGiven: firebase.firestore.FieldValue.increment(-1),
                reputation: firebase.firestore.FieldValue.increment(-5)
            });
            
            const repliesSnapshot = await db.collection('replies').where('answerId', '==', answerId).get();
            repliesSnapshot.forEach(doc => batch.delete(doc.ref));
            
            await batch.commit();

            loadAnswers(currentQuestionId);
            loadUserReputation();
            showAlert('Answer deleted successfully.', 'success');
        } catch (error) {
            console.error('Error deleting answer:', error);
            showAlert('Failed to delete the answer.');
        }
    });
}



async function submitAnswer(event) {
    event.preventDefault();
    if (!currentUser || !currentQuestionId) { return; }
    const body = document.getElementById('answer-body').value.trim();
    if (!body) { 
        showAlert('Please write an answer before submitting.');
        return; 
    }
    
    try {
        await db.collection('answers').add({
            questionId: currentQuestionId, body,
            authorId: currentUser.uid,
            authorName: currentUser.displayName || currentUser.email.split('@')[0],
            authorPhoto: currentUser.photoURL || '',
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            voteCount: 0, votes: {}
        });
        
        await db.collection('questions').doc(currentQuestionId).update({
            answerCount: firebase.firestore.FieldValue.increment(1)
        });
        
        await db.collection('users').doc(currentUser.uid).update({
            answersGiven: firebase.firestore.FieldValue.increment(1),
            reputation: firebase.firestore.FieldValue.increment(2)
        });
        
        document.getElementById('answer-form').reset();
        loadAnswers(currentQuestionId);
        loadUserReputation();
        showAlert('Your answer has been posted!', 'success');
    } catch (error) {
        console.error('Error posting answer:', error);
        showAlert('Could not post your answer.');
    }
}


// --- Event Listeners ---
function setupEventListeners() {
    // Auth Modals
    document.getElementById('login-btn').addEventListener('click', showLoginModal);
    document.getElementById('signup-btn').addEventListener('click', showSignupModal);
    document.getElementById('close-modal-btn').addEventListener('click', closeAuthModal);
    overlay.addEventListener('click', () => {
        closeAuthModal();
        closeConfirmModal();
        hideMentionsPopup();
        notificationsDropdown.style.display = 'none'; // Close notifications on overlay click
    });
    document.getElementById('auth-switch-link').addEventListener('click', toggleAuthMode);
    document.getElementById('google-signin-btn').addEventListener('click', signInWithGoogle);

    // Confirmation Modal Buttons
    document.getElementById('close-confirm-modal-btn').addEventListener('click', closeConfirmModal);
    document.getElementById('confirm-modal-cancel-btn').addEventListener('click', closeConfirmModal);
    document.getElementById('confirm-modal-confirm-btn').addEventListener('click', () => {
        if (typeof confirmCallback === 'function') {
            confirmCallback();
        }
        closeConfirmModal();
    });

    // Main Navigation
    document.getElementById('home-link').addEventListener('click', showHome);
    document.getElementById('ask-question-link').addEventListener('click', showAskQuestion);
    document.getElementById('ask-question-btn-main').addEventListener('click', showAskQuestion);

    // User Menu
    document.getElementById('user-info-wrapper').addEventListener('click', () => toggleUserMenu());
    document.getElementById('profile-link').addEventListener('click', showProfilePage);
    document.getElementById('logout-link').addEventListener('click', logout);
    
    // Notifications Listener
    notificationsBell.addEventListener('click', handleNotificationBellClick);

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

    // Mention Feature Listeners
    mentionsPopup = document.getElementById('mentions-popup');
    questionBodyTextarea = document.getElementById('question-body');
    if (questionBodyTextarea) {
        questionBodyTextarea.addEventListener('input', handleMentionInput);
        questionBodyTextarea.addEventListener('keydown', handleMentionKeyDown);
        questionBodyTextarea.addEventListener('blur', () => {
            setTimeout(hideMentionsPopup, 150);
        });
    }

    // Filters
    document.getElementById('filters').addEventListener('click', function(e) {
        if (e.target.matches('.filter-btn')) {
            document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
            e.target.classList.add('active');
            loadQuestions(e.target.dataset.filter);
        }
    });
}

// --- Utility Functions ---
function toggleUserMenu(forceClose = false) {
    const dropdown = document.getElementById('user-menu-dropdown');
    if (forceClose || dropdown.style.display === 'block') {
        dropdown.style.display = 'none';
    } else {
        dropdown.style.display = 'block';
    }
}

// Close dropdowns if clicked outside
window.addEventListener('click', function(event) {
    if (userMenu && !userMenu.contains(event.target)) {
        toggleUserMenu(true);
    }
    if (notificationsContainer && !notificationsContainer.contains(event.target)) {
        notificationsDropdown.style.display = 'none';
    }
});


function escapeHtml(text) {
    if (text === null || typeof text === 'undefined') return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.toString().replace(/[&<>"']/g, function(m) { return map[m]; });
}

function getTimeAgo(date) {
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) return 'just now';
    
    const diffInSeconds = Math.floor((new Date() - date) / 1000);
    const intervals = { 'y': 31536000, 'mo': 2592000, 'd': 86400, 'h': 3600, 'm': 60 };
    
    if (diffInSeconds < 60) return 'just now';
    
    for (const [unit, seconds] of Object.entries(intervals)) {
        const interval = diffInSeconds / seconds;
        if (interval > 1) return `${Math.floor(interval)}${unit} ago`;
    }
    return 'just now';
}

function getFriendlyAuthError(error) {
    switch (error.code) {
        case 'auth/invalid-email':
            return 'Please enter a valid email address.';
        case 'auth/user-not-found':
            return 'No account found with this email. Please sign up.';
        case 'auth/wrong-password':
            return 'Incorrect password. Please try again.';
        case 'auth/email-already-in-use':
            return 'This email is already registered. Please log in.';
        case 'auth/weak-password':
            return 'Your password should be at least 6 characters long.';
        default:
            return 'An authentication error occurred. Please try again.';
    }
}


// --- Voting Functions ---
async function vote(collection, docId, voteValue) {
    if (!currentUser) { 
        showAlert('Please log in to vote.');
        showLoginModal(); 
        return; 
    }
    
    const docRef = db.collection(collection).doc(docId);
    try {
        await db.runTransaction(async (transaction) => {
            const doc = await transaction.get(docRef);
            if (!doc.exists) throw new Error("Document does not exist!");
            
            const data = doc.data();
            if (data.authorId === currentUser.uid){
                showAlert("You cannot vote on your own content.");
                throw new Error("You cannot vote on your own content.");
            }
            
            const currentVote = data.votes[currentUser.uid] || 0;
            const newVote = voteValue === currentVote ? 0 : voteValue;
            const voteChange = newVote - currentVote;
            
            transaction.update(docRef, {
                voteCount: firebase.firestore.FieldValue.increment(voteChange),
                [`votes.${currentUser.uid}`]: newVote
            });
            
            if (data.authorId && voteChange !== 0) {
                const authorRef = db.collection('users').doc(data.authorId);
                const repChanges = { questions: 5, answers: 10 };
                let repChange = (newVote === 1 ? repChanges[collection] : -2);
                 if (currentVote !== 0) { // If changing vote, reverse old rep
                    repChange += (currentVote === 1 ? -repChanges[collection] : 2);
                 }
                transaction.update(authorRef, { reputation: firebase.firestore.FieldValue.increment(repChange) });
            }
        });
        
        if (collection === 'questions') loadQuestionDetail(docId);
        if (collection === 'answers') loadAnswers(currentQuestionId);
        loadUserReputation();
    } catch (error) {
        console.error("Vote transaction failed: ", error);
        if(error.message !== "You cannot vote on your own content."){
             showAlert('Your vote could not be processed.');
        }
    }
}

function voteQuestion(questionId, value) { vote('questions', questionId, value); }
function voteAnswer(answerId, value) { vote('answers', answerId, value); }

// --- In-App Notification Functions ---

function listenForNotifications() {
    if (notificationsListener) {
        notificationsListener(); // Unsubscribe from the old listener
    }

    if (!currentUser) {
        updateNotificationCount(0);
        return;
    }

    // This query requires a composite index on 'recipientId' (ascending) and 'timestamp' (descending).
    // Firestore will provide a link in the browser's console to create this index if it's missing.
    const notificationsQuery = db.collection('notifications')
        .where('recipientId', '==', currentUser.uid)
        .orderBy('timestamp', 'desc')
        .limit(30);

    notificationsListener = notificationsQuery.onSnapshot(snapshot => {
        // We count unread notifications on the client side after fetching the latest ones.
        const unreadCount = snapshot.docs.filter(doc => doc.data().isRead === false).length;
        updateNotificationCount(unreadCount);
    }, error => {
        console.error("Error listening for notifications:", error);
        // **UPDATED**: More specific error handling for the most common issue (missing index).
        if (error.code === 'failed-precondition') {
            console.error("Firestore index for notifications is missing. Firebase should have logged a link to create it in the console. This is required for notifications to work.");
            showAlert("Action Required: A database index is missing for notifications.");
        } else {
            showAlert("Could not check for new new notifications.");
        }
    });
}

function updateNotificationCount(count) {
    if (count > 0) {
        notificationsCount.textContent = count;
        notificationsCount.style.display = 'flex';
    } else {
        notificationsCount.style.display = 'none';
    }
}

async function handleNotificationBellClick() {
    notificationsDropdown.style.display = notificationsDropdown.style.display === 'block' ? 'none' : 'block';

    if (notificationsDropdown.style.display === 'block') {
        const listElement = document.getElementById('notifications-list');
        listElement.innerHTML = '<div class="loading">Loading...</div>';

        try {
            const query = db.collection('notifications')
                .where('recipientId', '==', currentUser.uid)
                .orderBy('timestamp', 'desc')
                .limit(15);
            
            const snapshot = await query.get();
            
            if (snapshot.empty) {
                listElement.innerHTML = '<div class="notification-item" style="text-align: center; padding: 20px;">You have no notifications.</div>';
                return;
            }

            const notifications = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            listElement.innerHTML = notifications.map(notification => {
                const timeAgo = getTimeAgo(notification.timestamp?.toDate());
                return `
                    <div id="notification-${notification.id}" class="notification-item ${notification.isRead ? '' : 'unread'}" >
                        <div class="notification-content" onclick="showQuestionDetail('${notification.questionId}'); markNotificationRead(event, '${notification.id}');">
                            <p class="notification-text">
                                <strong>${escapeHtml(notification.senderName)}</strong>
                                mentioned you in: 
                                <em>"${escapeHtml(notification.questionTitle)}"</em>
                            </p>
                            <span class="notification-time">${timeAgo}</span>
                        </div>
                        <button class="delete-notification-btn" onclick="deleteNotification(event, '${notification.id}')" title="Delete notification">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        </button>
                    </div>
                `;
            }).join('');

            // Mark these notifications as read in the background
            const unreadDocs = snapshot.docs.filter(doc => !doc.data().isRead);
            if (unreadDocs.length > 0) {
                const batch = db.batch();
                unreadDocs.forEach(doc => {
                    batch.update(doc.ref, { isRead: true });
                });
                await batch.commit();
            }

        } catch (error) {
            console.error("Error loading notifications:", error);
            if (error.code === 'failed-precondition') {
                 listElement.innerHTML = `<div class="notification-item" style="padding: 15px;">
                    <p style="font-weight: bold; color: #c82333;">Action Required</p>
                    <p>The database query for notifications failed. This usually means a composite index is missing.</p>
                    <p>Please check the browser's developer console (F12) for an error message from Firebase that includes a direct link to create the required index.</p>
                 </div>`;
            } else {
                 listElement.innerHTML = '<div class="notification-item">Could not load notifications.</div>';
            }
        }
    }
}

async function deleteNotification(event, notificationId) {
    event.stopPropagation();
    const notificationItem = document.getElementById(`notification-${notificationId}`);
    if (!notificationItem) return;

    notificationItem.classList.add('deleting');

    try {
        await db.collection('notifications').doc(notificationId).delete();
        // The transitionend listener will remove the element after the animation
        notificationItem.addEventListener('transitionend', () => {
            notificationItem.remove();
        });
    } catch(error) {
        console.error("Error deleting notification:", error);
        showAlert('Could not delete the notification.');
        notificationItem.classList.remove('deleting'); // Revert on failure
    }
}


// Mark a notification as read and navigate
async function markNotificationRead(event, notificationId) {
    event.stopPropagation(); 
    const notificationItem = event.currentTarget.parentElement; // The parent is the .notification-item
    
    notificationItem.classList.remove('unread'); 

    try {
        const notificationRef = db.collection('notifications').doc(notificationId);
        const doc = await notificationRef.get();
        if (doc.exists && doc.data().isRead === false) {
             await notificationRef.update({ isRead: true });
        }
    } catch (error) {
        console.error("Error marking notification as read:", error);
        notificationItem.classList.add('unread');
    }
}
