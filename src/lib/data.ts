
import { isToday } from 'date-fns';
import type { User, Lesson, LessonLog, UserRole, LessonRole, CxTrait, LessonCategory, EmailInvitation, Dealership } from './definitions';

// --- MOCK DATABASE ---

const dealerships: Dealership[] = [
  { id: 'dealership-A', name: 'Dealership A', trainerId: 'user-12' },
  { id: 'dealership-B', name: 'Dealership B' },
  { id: 'autoknerd-hq', name: 'AutoKnerd HQ' },
];

const users: User[] = [
  { userId: 'user-1', name: 'Alice Johnson', email: 'consultant@autodrive.com', role: 'Sales Consultant', dealershipIds: ['dealership-A'], avatarUrl: 'https://picsum.photos/seed/101/200/200', xp: 2580 },
  { userId: 'user-2', name: 'Bob Williams', email: 'manager@autodrive.com', role: 'manager', dealershipIds: ['dealership-A'], avatarUrl: 'https://picsum.photos/seed/102/200/200', xp: 5200 },
  { userId: 'user-3', name: 'Charlie Brown', email: 'charlie@autodrive.com', role: 'Sales Consultant', dealershipIds: ['dealership-A'], avatarUrl: 'https://picsum.photos/seed/103/200/200', xp: 550 },
  { userId: 'user-4', name: 'Diana Prince', email: 'diana@autodrive.com', role: 'Sales Consultant', dealershipIds: ['dealership-B'], avatarUrl: 'https://picsum.photos/seed/104/200/200', xp: 120 },
  { userId: 'user-5', name: 'Eve Adams', email: 'service.writer@autodrive.com', role: 'Service Writer', dealershipIds: ['dealership-A'], avatarUrl: 'https://picsum.photos/seed/105/200/200', xp: 800 },
  { userId: 'user-6', name: 'Frank Miller', email: 'service.manager@autodrive.com', role: 'Service Manager', dealershipIds: ['dealership-A'], avatarUrl: 'https://picsum.photos/seed/106/200/200', xp: 4800 },
  { userId: 'user-7', name: 'Grace Lee', email: 'finance.manager@autodrive.com', role: 'Finance Manager', dealershipIds: ['dealership-A'], avatarUrl: 'https://picsum.photos/seed/107/200/200', xp: 6000 },
  { userId: 'user-8', name: 'Henry Wilson', email: 'parts.consultant@autodrive.com', role: 'Parts Consultant', dealershipIds: ['dealership-A'], avatarUrl: 'https://picsum.photos/seed/108/200/200', xp: 450 },
  { userId: 'user-9', name: 'Ivy Green', email: 'parts.manager@autodrive.com', role: 'Parts Manager', dealershipIds: ['dealership-A'], avatarUrl: 'https://picsum.photos/seed/109/200/200', xp: 3200 },
  { userId: 'user-10', name: 'Jack King', email: 'owner@autodrive.com', role: 'Owner', dealershipIds: ['dealership-A', 'dealership-B'], avatarUrl: 'https://picsum.photos/seed/110/200/200', xp: 10000 },
  { userId: 'user-11', name: 'Sam Smith', email: 'sam.sw@autodrive.com', role: 'Service Writer', dealershipIds: ['dealership-A'], avatarUrl: 'https://picsum.photos/seed/111/200/200', xp: 150 },
  { userId: 'user-12', name: 'Travis Trainer', email: 'trainer@autoknerd.com', role: 'Trainer', dealershipIds: ['dealership-A'], avatarUrl: 'https://picsum.photos/seed/112/200/200', xp: 15000 },
  { userId: 'user-13', name: 'Andy Admin', email: 'admin@autoknerd.com', role: 'Admin', dealershipIds: ['autoknerd-hq'], avatarUrl: 'https://picsum.photos/seed/113/200/200', xp: 20000 },
  { userId: 'user-14', name: 'Manager B', email: 'manager.b@autodrive.com', role: 'manager', dealershipIds: ['dealership-B'], avatarUrl: 'https://picsum.photos/seed/114/200/200', xp: 4500 },
  { userId: 'user-15', name: 'Consultant B1', email: 'consultant.b1@autodrive.com', role: 'Sales Consultant', dealershipIds: ['dealership-B'], avatarUrl: 'https://picsum.photos/seed/115/200/200', xp: 30 },
];

const emailInvitations: EmailInvitation[] = [];


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


// LESSONS
export async function getLessons(role: LessonRole): Promise<Lesson[]> {
    await simulateNetworkDelay();
    return lessons.filter(l => l.role === role);
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
}) {
    await simulateNetworkDelay();
    
    const baseLesson = {
        title: lessonData.title,
        category: lessonData.category,
        associatedTrait: lessonData.associatedTrait,
        customScenario: lessonData.scenario,
    };

    const rolesToCreate: LessonRole[] = [];
    const validRoles: UserRole[] = ['Sales Consultant', 'manager', 'Service Writer', 'Service Manager', 'Finance Manager', 'Parts Consultant', 'Parts Manager', 'Trainer'];
    
    if (lessonData.targetRole === 'global') {
        rolesToCreate.push(...validRoles as LessonRole[]);
    } else if (validRoles.includes(lessonData.targetRole as UserRole)) {
        rolesToCreate.push(lessonData.targetRole as LessonRole);
    }

    for (const role of rolesToCreate) {
        const newLesson: Lesson = {
            ...baseLesson,
            lessonId: `lesson-${Math.floor(1000 + Math.random() * 9000)}`,
            role: role,
        };
        lessons.unshift(newLesson);
    }

    return { success: true };
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
}): Promise<User> {
    await simulateNetworkDelay();

    // 1. Find user and update XP
    const userIndex = users.findIndex(u => u.userId === data.userId);
    if (userIndex === -1) throw new Error('User not found');
    
    users[userIndex].xp += data.xpGained;

    // 2. Create and add new lesson log
    const newLog: LessonLog = {
        logId: `log-${lessonLogs.length + 1}`,
        timestamp: new Date(),
        userId: data.userId,
        lessonId: data.lessonId,
        xpGained: data.xpGained,
        isRecommended: data.isRecommended,
        stepResults: { final: 'pass' }, // Simplified for this implementation
        ...data.scores,
    };
    lessonLogs.unshift(newLog);

    console.log(`Logged lesson ${data.lessonId} for ${data.userId}. XP Gained: ${data.xpGained}. New total XP: ${users[userIndex].xp}`);

    // 3. Return updated user object
    return users[userIndex];
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
        case 'Owner':
             const ownerRoles = users.filter(u => u.role !== 'Owner' && u.role !== 'Admin' && u.role !== 'Trainer').map(u => u.role)
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

export async function getManagerStats(dealershipId: string, userRole: UserRole): Promise<{ totalLessons: number; avgEmpathy: number }> {
    await simulateNetworkDelay();

    const teamRoles = getTeamMemberRoles(userRole);
    
    let relevantLogs: LessonLog[];

    if ((['Owner', 'Admin', 'Trainer'].includes(userRole)) && dealershipId === 'all') {
        const teamUserIds = users.filter(u => !['Owner', 'Admin', 'Trainer'].includes(u.role)).map(u => u.userId);
        relevantLogs = lessonLogs.filter(log => teamUserIds.includes(log.userId));
    } else {
        const teamUserIds = users
            .filter(u => u.dealershipIds.includes(dealershipId) && teamRoles.includes(u.role))
            .map(u => u.userId);
        relevantLogs = lessonLogs.filter(log => teamUserIds.includes(log.userId));
    }
    
    if (relevantLogs.length === 0) {
        return { totalLessons: 0, avgEmpathy: 0 };
    }

    const totalLessons = relevantLogs.length;
    const totalEmpathy = relevantLogs.reduce((sum, log) => sum + log.empathy, 0);
    const avgEmpathy = Math.round(totalEmpathy / totalLessons);

    return { totalLessons, avgEmpathy };
}

export async function getTeamActivity(dealershipId: string, userRole: UserRole): Promise<{ consultant: User; lessonsCompleted: number; totalXp: number; avgScore: number; }[]> {
    await simulateNetworkDelay();

    const teamRoles = getTeamMemberRoles(userRole);

    let teamMembers: User[];

    if (['Owner', 'Admin', 'Trainer'].includes(userRole)) {
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
