

import { isToday } from 'date-fns';
import type { User, Lesson, LessonLog, UserRole, LessonRole, CxTrait, LessonCategory, EmailInvitation, Dealership, LessonAssignment, Badge, BadgeId, EarnedBadge } from './definitions';
import { allBadges } from './badges';
import { calculateLevel } from './xp';

// --- MOCK DATABASE ---

let dealerships: Dealership[] = [
  { id: 'dealership-A', name: 'Dealership A', trainerId: 'user-12' },
  { id: 'dealership-B', name: 'Dealership B' },
  { id: 'autoknerd-hq', name: 'AutoKnerd HQ' },
];

let users: User[] = [
  { userId: 'user-1', name: 'Alice Johnson', email: 'consultant@autodrive.com', role: 'Sales Consultant', dealershipIds: ['dealership-A'], avatarUrl: 'https://picsum.photos/seed/101/200/200', xp: 2580, phone: '555-0101', address: { street: '123 Oak Lane', city: 'Sunnyvale', state: 'CA', zip: '94086' }, isPrivate: false, isPrivateFromOwner: false, memberSince: '2023-01-15T09:00:00Z' },
  { userId: 'user-2', name: 'Bob Williams', email: 'manager@autodrive.com', role: 'manager', dealershipIds: ['dealership-A'], avatarUrl: 'https://picsum.photos/seed/102/200/200', xp: 5200, phone: '555-0102', address: { street: '456 Maple Drive', city: 'Sunnyvale', state: 'CA', zip: '94086' }, isPrivate: false, isPrivateFromOwner: false, memberSince: '2022-11-20T09:00:00Z' },
  { userId: 'user-3', name: 'Charlie Brown', email: 'charlie@autodrive.com', role: 'Sales Consultant', dealershipIds: ['dealership-A'], avatarUrl: 'https://picsum.photos/seed/103/200/200', xp: 550, isPrivate: false, isPrivateFromOwner: false, memberSince: '2023-08-01T09:00:00Z' },
  { userId: 'user-4', name: 'Diana Prince', email: 'diana@autodrive.com', role: 'Sales Consultant', dealershipIds: ['dealership-B'], avatarUrl: 'https://picsum.photos/seed/104/200/200', xp: 120, isPrivate: false, isPrivateFromOwner: false, memberSince: '2024-03-10T09:00:00Z' },
  { userId: 'user-5', name: 'Eve Adams', email: 'service.writer@autodrive.com', role: 'Service Writer', dealershipIds: ['dealership-A'], avatarUrl: 'https://picsum.photos/seed/105/200/200', xp: 800, isPrivate: false, isPrivateFromOwner: false, memberSince: '2023-05-22T09:00:00Z' },
  { userId: 'user-6', name: 'Frank Miller', email: 'service.manager@autodrive.com', role: 'Service Manager', dealershipIds: ['dealership-A'], avatarUrl: 'https://picsum.photos/seed/106/200/200', xp: 4800, isPrivate: false, isPrivateFromOwner: false, memberSince: '2022-09-15T09:00:00Z' },
  { userId: 'user-7', name: 'Grace Lee', email: 'finance.manager@autodrive.com', role: 'Finance Manager', dealershipIds: ['dealership-A'], avatarUrl: 'https://picsum.photos/seed/107/200/200', xp: 6195, isPrivate: false, isPrivateFromOwner: false, memberSince: '2022-07-01T09:00:00Z' },
  { userId: 'user-8', name: 'Henry Wilson', email: 'parts.consultant@autodrive.com', role: 'Parts Consultant', dealershipIds: ['dealership-A'], avatarUrl: 'https://picsum.photos/seed/108/200/200', xp: 535, isPrivate: false, isPrivateFromOwner: false, memberSince: '2023-10-30T09:00:00Z' },
  { userId: 'user-9', name: 'Ivy Green', email: 'parts.manager@autodrive.com', role: 'Parts Manager', dealershipIds: ['dealership-A'], avatarUrl: 'https://picsum.photos/seed/109/200/200', xp: 3275, isPrivate: false, isPrivateFromOwner: false, memberSince: '2023-02-18T09:00:00Z' },
  { userId: 'user-10', name: 'Jack King', email: 'owner@autodrive.com', role: 'Owner', dealershipIds: ['dealership-A', 'dealership-B'], avatarUrl: 'https://picsum.photos/seed/110/200/200', xp: 10000, isPrivate: false, isPrivateFromOwner: false, memberSince: '2021-01-01T09:00:00Z' },
  { userId: 'user-11', name: 'Sam Smith', email: 'sam.sw@autodrive.com', role: 'Service Writer', dealershipIds: ['dealership-A'], avatarUrl: 'https://picsum.photos/seed/111/200/200', xp: 150, isPrivate: false, isPrivateFromOwner: false, memberSince: '2024-05-01T09:00:00Z' },
  { userId: 'user-12', name: 'Travis Trainer', email: 'trainer@autoknerd.com', role: 'Trainer', dealershipIds: ['dealership-A'], avatarUrl: 'https://picsum.photos/seed/112/200/200', xp: 15000, isPrivate: false, isPrivateFromOwner: false, memberSince: '2022-01-01T09:00:00Z' },
  { userId: 'user-13', name: 'Andy Admin', email: 'admin@autoknerd.com', role: 'Admin', dealershipIds: ['autoknerd-hq'], avatarUrl: 'https://picsum.photos/seed/113/200/200', xp: 20000, isPrivate: false, isPrivateFromOwner: false, memberSince: '2022-01-01T09:00:00Z' },
  { userId: 'user-14', name: 'Manager B', email: 'manager.b@autodrive.com', role: 'manager', dealershipIds: ['dealership-B'], avatarUrl: 'https://picsum.photos/seed/114/200/200', xp: 4585, isPrivate: false, isPrivateFromOwner: false, memberSince: '2023-03-01T09:00:00Z' },
  { userId: 'user-15', name: 'Consultant B1', email: 'consultant.b1@autodrive.com', role: 'Sales Consultant', dealershipIds: ['dealership-B'], avatarUrl: 'https://picsum.photos/seed/115/200/200', xp: 30, isPrivate: false, isPrivateFromOwner: false, memberSince: '2024-06-01T09:00:00Z' },
  { userId: 'user-16', name: 'Gerry Manager', email: 'gm@autodrive.com', role: 'General Manager', dealershipIds: ['dealership-A', 'dealership-B'], avatarUrl: 'https://picsum.photos/seed/116/200/200', xp: 9000, isPrivate: false, isPrivateFromOwner: false, memberSince: '2021-06-01T09:00:00Z' },
];

let emailInvitations: EmailInvitation[] = [];

let lessons: Lesson[] = [
    { lessonId: 'lesson-1', title: 'Building Rapport on the Lot', role: 'Sales Consultant', category: 'Sales - Meet and Greet', associatedTrait: 'relationshipBuilding', customScenario: 'A customer arrives on the lot and is looking at a new SUV. They seem hesitant to be approached. What are your first words?' },
    { lessonId: 'lesson-2', title: 'Uncovering Customer Needs', role: 'Sales Consultant', category: 'Sales - Needs Assessment', associatedTrait: 'listening', customScenario: 'A customer says they "just want something reliable." How do you dig deeper to find out what "reliable" means to them and what other needs they might have?' },
    { lessonId: 'lesson-3', title: 'Handling Price Objections', role: 'Sales Consultant', category: 'Sales - Negotiation', associatedTrait: 'trust', customScenario: 'After presenting the numbers, the customer says, "That\'s more than I was hoping to spend. Can you do better?" What is your response?' },
    { lessonId: 'lesson-4', title: 'Confident Closing', role: 'Sales Consultant', category: 'Sales - Closing', associatedTrait: 'closing', customScenario: 'The test drive went great and the customer loves the car. How do you transition from the test drive to asking for the sale?' },
    { lessonId: 'lesson-5', title: 'Service Follow-up Excellence', role: 'Service Writer', category: 'Service - Status Updates', associatedTrait: 'followUp', customScenario: 'A customer dropped their car off for a complex repair. It\'s mid-afternoon. What information do you provide when you call them with an update?' },
    { lessonId: 'lesson-6', title: 'The Perfect Service Greeting', role: 'Service Writer', category: 'Service - Write-up', associatedTrait: 'empathy', customScenario: 'A customer pulls into the service drive. They look stressed and tell you "the car is making a funny noise." How do you greet them and begin the write-up process?'},
    { lessonId: 'lesson-7', title: 'Mastering the F&I Menu', role: 'Finance Manager', category: 'F&I - Menu Selling', associatedTrait: 'trust', customScenario: 'You are presenting the F&I menu to a customer who seems skeptical about additional products. How do you build trust and explain the value?' },
    { lessonId: 'lesson-8', title: 'Precision in Parts Identification', role: 'Parts Consultant', category: 'Parts - Identifying Needs', associatedTrait: 'listening', customScenario: 'A technician asks for a "water pump for a 2018 Accord." What clarifying questions do you ask to ensure you provide the exact right part?' },
];

let lessonLogs: LessonLog[] = [
  { logId: 'log-1', timestamp: new Date('2024-07-10T10:00:00Z'), userId: 'user-1', lessonId: 'lesson-1', stepResults: { final: 'pass' }, xpGained: 75, empathy: 80, listening: 70, trust: 85, followUp: 60, closing: 65, relationshipBuilding: 90, isRecommended: true },
  { logId: 'log-2', timestamp: new Date('2024-07-09T11:00:00Z'), userId: 'user-1', lessonId: 'lesson-2', stepResults: { final: 'pass' }, xpGained: 60, empathy: 70, listening: 55, trust: 75, followUp: 65, closing: 60, relationshipBuilding: 80, isRecommended: false },
  { logId: 'log-3', timestamp: new Date('2024-07-11T14:00:00Z'), userId: 'user-3', lessonId: 'lesson-1', stepResults: { final: 'pass' }, xpGained: 80, empathy: 85, listening: 75, trust: 90, followUp: 70, closing: 70, relationshipBuilding: 95, isRecommended: true },
  { logId: 'log-4', timestamp: new Date('2024-07-12T09:30:00Z'), userId: 'user-4', lessonId: 'lesson-2', stepResults: { final: 'fail' }, xpGained: 20, empathy: 60, listening: 40, trust: 50, followUp: 55, closing: 45, relationshipBuilding: 60, isRecommended: true },
  { logId: 'log-5', timestamp: new Date('2024-07-12T11:00:00Z'), userId: 'user-5', lessonId: 'lesson-6', stepResults: { final: 'pass' }, xpGained: 90, empathy: 95, listening: 85, trust: 90, followUp: 80, closing: 80, relationshipBuilding: 90, isRecommended: true },
  { logId: 'log-6', timestamp: new Date('2024-07-12T13:00:00Z'), userId: 'user-11', lessonId: 'lesson-5', stepResults: { final: 'pass' }, xpGained: 70, empathy: 70, listening: 80, trust: 75, followUp: 90, closing: 50, relationshipBuilding: 60, isRecommended: false },
  { logId: 'log-7', timestamp: new Date('2024-07-12T15:00:00Z'), userId: 'user-8', lessonId: 'lesson-8', stepResults: { final: 'pass' }, xpGained: 85, empathy: 75, listening: 95, trust: 80, followUp: 88, closing: 70, relationshipBuilding: 80, isRecommended: true },
  { logId: 'log-8', timestamp: new Date('2024-07-11T09:00:00Z'), userId: 'user-7', lessonId: 'lesson-7', stepResults: { final: 'pass' }, xpGained: 95, empathy: 80, listening: 85, trust: 98, followUp: 80, closing: 92, relationshipBuilding: 85, isRecommended: false },
  { logId: 'log-9', timestamp: new Date('2024-07-10T16:00:00Z'), userId: 'user-15', lessonId: 'lesson-4', stepResults: { final: 'fail' }, xpGained: 30, empathy: 65, listening: 60, trust: 55, followUp: 70, closing: 40, relationshipBuilding: 50, isRecommended: true },
  { logId: 'log-10', timestamp: new Date('2024-07-08T10:00:00Z'), userId: 'user-2', lessonId: 'lesson-3', stepResults: { final: 'pass' }, xpGained: 100, empathy: 90, listening: 90, trust: 95, followUp: 85, closing: 90, relationshipBuilding: 90, isRecommended: false },
  { logId: 'log-11', timestamp: new Date('2024-07-09T10:00:00Z'), userId: 'user-6', lessonId: 'lesson-5', stepResults: { final: 'pass' }, xpGained: 80, empathy: 88, listening: 85, trust: 80, followUp: 95, closing: 70, relationshipBuilding: 82, isRecommended: false },
  { logId: 'log-12', timestamp: new Date('2024-07-10T10:00:00Z'), userId: 'user-9', lessonId: 'lesson-8', stepResults: { final: 'pass' }, xpGained: 75, empathy: 80, listening: 90, trust: 85, followUp: 70, closing: 70, relationshipBuilding: 75, isRecommended: false },
  { logId: 'log-13', timestamp: new Date('2024-07-11T10:00:00Z'), userId: 'user-14', lessonId: 'lesson-1', stepResults: { final: 'pass' }, xpGained: 85, empathy: 80, listening: 80, trust: 85, followUp: 80, closing: 85, relationshipBuilding: 95, isRecommended: false },
  { logId: 'log-14', timestamp: new Date('2024-07-13T10:00:00Z'), userId: 'user-7', lessonId: 'lesson-7', stepResults: { final: 'pass' }, xpGained: 100, empathy: 85, listening: 88, trust: 99, followUp: 82, closing: 95, relationshipBuilding: 88, isRecommended: false },
  { logId: 'log-15', timestamp: new Date('2024-07-13T11:00:00Z'), userId: 'user-8', lessonId: 'lesson-8', stepResults: { final: 'pass' }, xpGained: 50, empathy: 70, listening: 85, trust: 75, followUp: 80, closing: 65, relationshipBuilding: 70, isRecommended: false },
  { logId: 'log-16', timestamp: new Date('2024-07-13T12:00:00Z'), userId: 'user-2', lessonId: 'lesson-4', stepResults: { final: 'pass' }, xpGained: 90, empathy: 85, listening: 85, trust: 90, followUp: 90, closing: 95, relationshipBuilding: 92, isRecommended: true },
  { logId: 'log-17', timestamp: new Date('2024-07-13T13:00:00Z'), userId: 'user-6', lessonId: 'lesson-6', stepResults: { final: 'pass' }, xpGained: 75, empathy: 90, listening: 80, trust: 85, followUp: 90, closing: 70, relationshipBuilding: 80, isRecommended: false },
  { logId: 'log-18', timestamp: new Date('2024-07-13T14:00:00Z'), userId: 'user-9', lessonId: 'lesson-8', stepResults: { final: 'pass' }, xpGained: 75, empathy: 82, listening: 92, trust: 88, followUp: 75, closing: 72, relationshipBuilding: 78, isRecommended: false },
  { logId: 'log-19', timestamp: new Date('2024-07-13T15:00:00Z'), userId: 'user-14', lessonId: 'lesson-2', stepResults: { final: 'pass' }, xpGained: 70, empathy: 75, listening: 85, trust: 80, followUp: 75, closing: 70, relationshipBuilding: 80, isRecommended: false },
];

let lessonAssignments: LessonAssignment[] = [
    { assignmentId: 'assign-1', userId: 'user-1', lessonId: 'lesson-3', assignerId: 'user-2', timestamp: new Date(), completed: false }
];

let earnedBadges: EarnedBadge[] = [
    { userId: 'user-1', badgeId: 'first-drive', timestamp: new Date('2024-07-09T11:00:00Z') },
    { userId: 'user-1', badgeId: 'xp-1000', timestamp: new Date('2024-07-10T10:00:00Z') },
    { userId: 'user-1', badgeId: 'top-performer', timestamp: new Date('2024-07-10T10:00:00Z') },
    { userId: 'user-1', badgeId: 'relationship-ace', timestamp: new Date('2024-07-11T14:00:00Z') },
    { userId: 'user-1', badgeId: 'night-owl', timestamp: new Date('2024-07-11T01:00:00Z') },
];


// --- MOCK API FUNCTIONS ---

const simulateNetworkDelay = () => new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 500));

// AUTH
export async function authenticateUser(email: string, pass: string): Promise<User | null> {
    await simulateNetworkDelay();
    console.log(`Authenticating ${email}...`);
    // This is a mock authentication. In a real app, you'd use Firebase Auth.
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (user) {
        // Mocking a successful password check
        return user;
    }
    return null;
}

export async function getUserById(userId: string): Promise<User | null> {
    await simulateNetworkDelay();
    return users.find(u => u.userId === userId) || null;
}

export async function findUserByEmail(email: string, requestingUserId: string): Promise<User | null> {
    await simulateNetworkDelay();
    const foundUser = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (!foundUser) {
        return null;
    }

    const requestingUser = users.find(u => u.userId === requestingUserId);
    if (!requestingUser) {
        // This case should ideally not happen if the app is consistent.
        // Returning null is a safe default.
        return null; 
    }

    // Admins and Trainers have universal access
    if (['Admin', 'Trainer'].includes(requestingUser.role)) {
        return foundUser;
    }

    // Allow seeing unassigned users
    if (foundUser.dealershipIds.length === 0) {
        return foundUser;
    }

    // Allow seeing users in one of the manager/owner's dealerships
    const inManagedDealership = foundUser.dealershipIds.some(id => requestingUser.dealershipIds.includes(id));
    if (inManagedDealership) {
        return foundUser;
    }

    // If none of the above, the user is not visible to the requester
    return null;
}

export async function redeemInvitation(token: string, name: string, email: string): Promise<User> {
    await simulateNetworkDelay();
    
    const invitation = emailInvitations.find(inv => inv.token === token);

    if (!invitation) {
        throw new Error("Invalid invitation link.");
    }
    if (invitation.claimed) {
        throw new Error("This invitation has already been used.");
    }
     if (invitation.email.toLowerCase() !== email.toLowerCase()) {
        throw new Error("This invitation is for a different email address.");
    }
    if (users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
        throw new Error("An account with this email already exists.");
    }

    const newUserId = `user-${users.length + 1}`;
    const newUser: User = {
        userId: newUserId,
        name: name,
        email: email,
        role: invitation.role,
        dealershipIds: [invitation.dealershipId],
        avatarUrl: `https://picsum.photos/seed/${newUserId}/200/200`,
        xp: 0,
        isPrivate: false,
        isPrivateFromOwner: false,
        memberSince: new Date().toISOString(),
    };

    users.push(newUser);
    invitation.claimed = true;

    console.log(`Redeemed invitation for ${email}.`);

    return newUser;
}

export async function getInvitationByToken(token: string): Promise<EmailInvitation | null> {
    await simulateNetworkDelay();
    const invitation = emailInvitations.find(inv => inv.token === token);
    return invitation || null;
}

export async function updateUser(userId: string, data: Partial<Omit<User, 'userId' | 'role' | 'xp' | 'dealershipIds'>>): Promise<User> {
    await simulateNetworkDelay();
    const userIndex = users.findIndex(u => u.userId === userId);
    if (userIndex === -1) {
        throw new Error("User not found.");
    }

    const updatedUser = { ...users[userIndex], ...data };
    users[userIndex] = updatedUser;
    
    console.log(`Updated user ${userId}:`, data);
    return updatedUser;
}

export async function updateUserDealerships(userId: string, newDealershipIds: string[]): Promise<User> {
    await simulateNetworkDelay();
    const userIndex = users.findIndex(u => u.userId === userId);
    if (userIndex === -1) {
        throw new Error("User not found.");
    }

    for (const id of newDealershipIds) {
        const dealershipExists = dealerships.some(d => d.id === id);
        if (!dealershipExists) {
            throw new Error(`Dealership with id ${id} not found.`);
        }
    }
    
    users[userIndex].dealershipIds = newDealershipIds;
    console.log(`Assigned user ${userId} to dealerships ${newDealershipIds.join(', ')}`);
    return users[userIndex];
}

export async function deleteUser(userId: string): Promise<void> {
    await simulateNetworkDelay();
    const userIndex = users.findIndex(u => u.userId === userId);
    if (userIndex === -1) {
        throw new Error("User not found.");
    }
    
    // Remove user
    users.splice(userIndex, 1);
    
    // Remove associated data
    lessonLogs = lessonLogs.filter(log => log.userId !== userId);
    lessonAssignments = lessonAssignments.filter(assign => assign.userId !== userId);
    earnedBadges = earnedBadges.filter(b => b.userId !== userId);


    console.log(`Permanently deleted user ${userId} and their associated data.`);
}


// LESSONS
export async function getLessons(role: LessonRole): Promise<Lesson[]> {
    await simulateNetworkDelay();
    const globalLessons = lessons.filter(l => l.role === 'global');
    const roleLessons = lessons.filter(l => l.role === role);
    return [...globalLessons, ...roleLessons];
}

export async function getLessonById(lessonId: string): Promise<Lesson | null> {
    await simulateNetworkDelay();
    return lessons.find(l => l.lessonId === lessonId) || null;
}

export async function getDealershipById(dealershipId: string): Promise<Dealership | null> {
    await simulateNetworkDelay();
    return dealerships.find(d => d.id === dealershipId) || null;
}

export async function createLesson(lessonData: {
    title: string;
    category: LessonCategory;
    associatedTrait: CxTrait;
    targetRole: UserRole | 'global';
    scenario: string;
}): Promise<Lesson> {
    await simulateNetworkDelay();
    
    const newLesson: Lesson = {
        lessonId: `lesson-${Math.floor(1000 + Math.random() * 9000)}`,
        title: lessonData.title,
        category: lessonData.category,
        associatedTrait: lessonData.associatedTrait,
        role: lessonData.targetRole as LessonRole,
        customScenario: lessonData.scenario,
    };
    
    lessons.unshift(newLesson);

    return newLesson;
}

export async function getAssignedLessons(userId: string): Promise<Lesson[]> {
    await simulateNetworkDelay();
    const assignments = lessonAssignments.filter(a => a.userId === userId && !a.completed);
    const assignedLessonIds = assignments.map(a => a.lessonId);
    return lessons.filter(l => assignedLessonIds.includes(l.lessonId));
}

export async function assignLesson(userId: string, lessonId: string, assignerId: string): Promise<LessonAssignment> {
    await simulateNetworkDelay();
    if (!users.some(u => u.userId === userId)) throw new Error("User to assign to not found.");
    if (!users.some(u => u.userId === assignerId)) throw new Error("Assigner not found.");
    if (!lessons.some(l => l.lessonId === lessonId)) throw new Error("Lesson not found.");

    const newAssignment: LessonAssignment = {
        assignmentId: `assign-${lessonAssignments.length + 1}`,
        userId,
        lessonId,
        assignerId,
        timestamp: new Date(),
        completed: false,
    };
    lessonAssignments.push(newAssignment);
    console.log(`Assigned lesson ${lessonId} to user ${userId} by ${assignerId}`);
    return newAssignment;
}


export async function getConsultantActivity(userId: string): Promise<LessonLog[]> {
    await simulateNetworkDelay();
    return lessonLogs.filter(log => log.userId === userId).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
}

export async function getDailyLessonLimits(userId: string): Promise<{ recommendedTaken: boolean, otherTaken: boolean }> {
    await simulateNetworkDelay();
    const todayLogs = lessonLogs.filter(log => log.userId === userId && isToday(log.timestamp));
    
    const recommendedTaken = todayLogs.some(log => log.isRecommended);
    const otherTaken = todayLogs.some(log => !log.isRecommended);

    return { recommendedTaken, otherTaken };
}

export async function logLessonCompletion(data: {
    userId: string;
    lessonId: string;
    xpGained: number;
    isRecommended: boolean;
    scores: Omit<LessonLog, 'logId' | 'timestamp' | 'userId' | 'lessonId' | 'stepResults' | 'xpGained' | 'isRecommended'>;
}): Promise<{ updatedUser: User, newBadges: Badge[] }> {
    await simulateNetworkDelay();

    // 1. Find user and create new log
    const userIndex = users.findIndex(u => u.userId === data.userId);
    if (userIndex === -1) throw new Error('User not found');
    const user = users[userIndex];

    const newLog: LessonLog = {
        logId: `log-${lessonLogs.length + 1}`,
        timestamp: new Date(),
        userId: data.userId,
        lessonId: data.lessonId,
        xpGained: data.xpGained,
        isRecommended: data.isRecommended,
        stepResults: { final: 'pass' },
        ...data.scores,
    };
    
    // 2. Get user history for badge checks
    const userLogs = lessonLogs.filter(log => log.userId === data.userId);
    const userBadgeIds = earnedBadges.filter(b => b.userId === data.userId).map(b => b.badgeId);
    const newlyAwardedBadges: Badge[] = [];
    
    const awardBadge = (badgeId: BadgeId) => {
        if (!userBadgeIds.includes(badgeId)) {
            earnedBadges.push({ userId: data.userId, badgeId, timestamp: new Date() });
            const badge = allBadges.find(b => b.id === badgeId);
            if (badge) newlyAwardedBadges.push(badge);
        }
    };
    
    // 3. Check for badges
    // Milestone Badges
    if (userLogs.length === 0) awardBadge('first-drive');
    const newXp = user.xp + data.xpGained;
    if (user.xp < 1000 && newXp >= 1000) awardBadge('xp-1000');
    if (user.xp < 5000 && newXp >= 5000) awardBadge('xp-5000');
    if (user.xp < 10000 && newXp >= 10000) awardBadge('xp-10000');

    const levelBefore = calculateLevel(user.xp).level;
    const levelAfter = calculateLevel(newXp).level;
    if (levelBefore < 10 && levelAfter >= 10) awardBadge('level-10');
    if (levelBefore < 25 && levelAfter >= 25) awardBadge('level-25');

    // Performance Badges
    const lessonScore = Object.values(data.scores).reduce((sum, score) => sum + score, 0) / 6;
    if (lessonScore >= 95) awardBadge('top-performer');
    if (lessonScore === 100) awardBadge('perfectionist');
    
    // Special Achievement Badges
    const hour = newLog.timestamp.getHours();
    if (hour >= 0 && hour < 4) awardBadge('night-owl');
    if (hour >= 4 && hour < 7) awardBadge('early-bird');
    
    const assignmentIndex = lessonAssignments.findIndex(a => a.userId === data.userId && a.lessonId === data.lessonId && !a.completed);
    if (assignmentIndex !== -1) {
        lessonAssignments[assignmentIndex].completed = true;
        awardBadge('managers-pick');
    }

    // 4. Update state
    users[userIndex].xp = newXp;
    lessonLogs.unshift(newLog);
    
    console.log(`Logged lesson ${data.lessonId} for ${data.userId}. XP Gained: ${data.xpGained}. New total XP: ${users[userIndex].xp}`);
    if (newlyAwardedBadges.length > 0) {
        console.log(`Awarded badges: ${newlyAwardedBadges.map(b => b.name).join(', ')}`);
    }

    return { updatedUser: users[userIndex], newBadges: newlyAwardedBadges };
}


// MANAGER
export const getTeamMemberRoles = (managerRole: UserRole): UserRole[] => {
    switch (managerRole) {
        case 'manager':
            return ['Sales Consultant'];
        case 'Service Manager':
            return ['Service Writer'];
        case 'Parts Manager':
            return ['Parts Consultant'];
        case 'General Manager':
        case 'Owner':
             const ownerRoles = users.filter(u => u.role !== 'Owner' && u.role !== 'Admin' && u.role !== 'Trainer' && u.role !== 'General Manager').map(u => u.role)
             return [...new Set(ownerRoles)];
        case 'Trainer':
            const trainerRoles = users.filter(u => u.role !== 'Admin' && u.role !== 'Trainer').map(u => u.role);
            return [...new Set(trainerRoles)];
        case 'Admin':
            const adminRoles = users.filter(u => u.role !== 'Admin').map(u => u.role);
            return [...new Set(adminRoles)];
        default:
            return [];
    }
};

export async function getDealerships(user?: User): Promise<Dealership[]> {
    await simulateNetworkDelay();

    let relevantDealerships = dealerships.filter(d => d.id !== 'autoknerd-hq');

    if (user && user.role === 'Trainer') {
        relevantDealerships = relevantDealerships.filter(d => d.trainerId === user.userId);
    }
    
    return relevantDealerships;
}

export async function getManagerStats(dealershipId: string, userRole: UserRole): Promise<{ totalLessons: number; avgScores: Record<CxTrait, number> | null }> {
    await simulateNetworkDelay();

    const teamRoles = getTeamMemberRoles(userRole);
    
    let relevantLogs: LessonLog[];

    if ((['Owner', 'Admin', 'Trainer', 'General Manager'].includes(userRole)) && dealershipId === 'all') {
        const teamUserIds = users.filter(u => !['Owner', 'Admin', 'Trainer', 'General Manager'].includes(u.role)).map(u => u.userId);
        relevantLogs = lessonLogs.filter(log => teamUserIds.includes(log.userId));
    } else {
        const teamUserIds = users
            .filter(u => u.dealershipIds.includes(dealershipId) && teamRoles.includes(u.role))
            .map(u => u.userId);
        relevantLogs = lessonLogs.filter(log => teamUserIds.includes(log.userId));
    }
    
    if (relevantLogs.length === 0) {
        return { totalLessons: 0, avgScores: null };
    }

    const totalLessons = relevantLogs.length;
    const cxTraits: CxTrait[] = ['empathy', 'listening', 'trust', 'followUp', 'closing', 'relationshipBuilding'];

    const avgScores = cxTraits.reduce((acc, trait) => {
        const totalScore = relevantLogs.reduce((sum, log) => sum + log[trait], 0);
        acc[trait] = Math.round(totalScore / totalLessons);
        return acc;
    }, {} as Record<CxTrait, number>);

    return { totalLessons, avgScores };
}

export async function getTeamActivity(dealershipId: string, userRole: UserRole): Promise<{ consultant: User; lessonsCompleted: number; totalXp: number; avgScore: number; }[]> {
    await simulateNetworkDelay();

    const teamRoles = getTeamMemberRoles(userRole);

    let teamMembers: User[];

    if (['Owner', 'Admin', 'Trainer', 'General Manager'].includes(userRole)) {
        if (dealershipId === 'all') {
            teamMembers = users.filter(u => teamRoles.includes(u.role));
        } else {
            teamMembers = users.filter(u => u.dealershipIds.includes(dealershipId) && teamRoles.includes(u.role));
        }
    } else {
         teamMembers = users.filter(u => u.dealershipIds.includes(dealershipId) && teamRoles.includes(u.role));
    }
    
    const activity = teamMembers.map(member => {
        const memberLogs = lessonLogs.filter(log => log.userId === member.userId);
        if (memberLogs.length === 0) {
            return { consultant: member, lessonsCompleted: 0, totalXp: member.xp, avgScore: 0 };
        }

        const lessonsCompleted = memberLogs.length;
        const totalXp = member.xp;
        
        const totalScore = memberLogs.reduce((sum, log) => {
            return sum + (log.empathy + log.listening + log.trust + log.followUp + log.closing + log.relationshipBuilding);
        }, 0);
        
        const avgScore = Math.round(totalScore / (memberLogs.length * 6));

        return { consultant: member, lessonsCompleted, totalXp, avgScore };
    });

    return activity.sort((a, b) => b.totalXp - a.totalXp);
}

export async function getManageableUsers(managerId: string): Promise<User[]> {
    await simulateNetworkDelay();
    
    const manager = users.find(u => u.userId === managerId);
    if (!manager) return [];

    const manageableRoles = getTeamMemberRoles(manager.role);

    if (['Admin', 'Trainer'].includes(manager.role)) {
        // Admins/Trainers can manage everyone in manageable roles, regardless of dealership.
        return users.filter(u => manageableRoles.includes(u.role) && u.userId !== managerId)
            .sort((a, b) => a.name.localeCompare(b.name));
    }
    
    // For Owners and Managers
    const manageableUsers = users.filter(u => {
        if (u.userId === managerId) return false; // Can't manage self
        if (!manageableRoles.includes(u.role)) return false; // Not a role they can manage

        // Is the user unassigned?
        if (u.dealershipIds.length === 0) {
            return true;
        }

        // Is the user in one of the manager's dealerships?
        const inManagedDealership = u.dealershipIds.some(id => manager.dealershipIds.includes(id));
        if (inManagedDealership) {
            return true;
        }

        return false;
    });

    return manageableUsers.sort((a, b) => a.name.localeCompare(b.name));
}


export async function sendInvitation(
    dealershipName: string, 
    userEmail: string, 
    role: UserRole,
    creatorId: string
): Promise<void> {
    await simulateNetworkDelay();

    let dealership = dealerships.find(d => d.name.toLowerCase() === dealershipName.toLowerCase());
    let dealershipId: string;

    if (!dealership) {
        const creator = users.find(u => u.userId === creatorId);
        if (creator && ['Admin', 'Trainer'].includes(creator.role)) {
            dealershipId = dealershipName.toLowerCase().replace(/\s+/g, '-');
            
            const newDealership: Dealership = {
                id: dealershipId,
                name: dealershipName,
            };
            if (creator.role === 'Trainer') {
                newDealership.trainerId = creatorId;
            }

            dealerships.push(newDealership);
            console.log(`Created new dealership: ${dealershipName} with ID ${dealershipId}`);
        } else {
            throw new Error('You do not have permission to create a new dealership.');
        }

    } else {
        dealershipId = dealership.id;
    }

    const token = Math.random().toString(36).slice(2, 18).toUpperCase();
    
    const newInvitation: EmailInvitation = {
        token: token,
        dealershipId: dealershipId,
        role: role,
        email: userEmail,
        claimed: false,
    };
    
    emailInvitations.push(newInvitation);

    // In a real app, you would send an email here.
    // For this demo, we'll log a "magic link" to the console.
    console.log('--- EMAIL INVITATION (SIMULATED) ---');
    console.log(`To: ${userEmail}`);
    console.log('Subject: You are invited to join AutoDrive!');
    console.log(`Click here to register: http://localhost:9002/register?token=${token}`);
    console.log('------------------------------------');
}


// BADGES
export async function getEarnedBadgesByUserId(userId: string): Promise<Badge[]> {
    await simulateNetworkDelay();
    const userBadgeIds = earnedBadges.filter(b => b.userId === userId).map(b => b.badgeId);
    return allBadges.filter(b => userBadgeIds.includes(b.id));
}
