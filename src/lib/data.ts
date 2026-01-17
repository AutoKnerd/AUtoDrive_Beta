
import { isToday } from 'date-fns';
import type { User, Lesson, LessonLog, UserRole, LessonRole, CxTrait, LessonCategory } from './definitions';

// --- MOCK DATABASE ---

const users: User[] = [
  { userId: 'user-1', name: 'Alice Johnson', email: 'consultant@autodrive.com', role: 'consultant', dealershipId: 'dealership-A', avatarUrl: 'https://picsum.photos/seed/101/200/200', xp: 2580 },
  { userId: 'user-2', name: 'Bob Williams', email: 'manager@autodrive.com', role: 'manager', dealershipId: 'dealership-A', avatarUrl: 'https://picsum.photos/seed/102/200/200', xp: 5200 },
  { userId: 'user-3', name: 'Charlie Brown', email: 'charlie@autodrive.com', role: 'consultant', dealershipId: 'dealership-A', avatarUrl: 'https://picsum.photos/seed/103/200/200', xp: 550 },
  { userId: 'user-4', name: 'Diana Prince', email: 'diana@autodrive.com', role: 'consultant', dealershipId: 'dealership-B', avatarUrl: 'https://picsum.photos/seed/104/200/200', xp: 120 },
  { userId: 'user-5', name: 'Eve Adams', email: 'service.writer@autodrive.com', role: 'Service Writer', dealershipId: 'dealership-A', avatarUrl: 'https://picsum.photos/seed/105/200/200', xp: 800 },
  { userId: 'user-6', name: 'Frank Miller', email: 'service.manager@autodrive.com', role: 'Service Manager', dealershipId: 'dealership-A', avatarUrl: 'https://picsum.photos/seed/106/200/200', xp: 4800 },
  { userId: 'user-7', name: 'Grace Lee', email: 'finance.manager@autodrive.com', role: 'Finance Manager', dealershipId: 'dealership-A', avatarUrl: 'https://picsum.photos/seed/107/200/200', xp: 6000 },
  { userId: 'user-8', name: 'Henry Wilson', email: 'parts.consultant@autodrive.com', role: 'Parts Consultant', dealershipId: 'dealership-A', avatarUrl: 'https://picsum.photos/seed/108/200/200', xp: 450 },
  { userId: 'user-9', name: 'Ivy Green', email: 'parts.manager@autodrive.com', role: 'Parts Manager', dealershipId: 'dealership-A', avatarUrl: 'https://picsum.photos/seed/109/200/200', xp: 3200 },
  { userId: 'user-10', name: 'Jack King', email: 'owner@autodrive.com', role: 'Owner', dealershipId: 'dealership-A', avatarUrl: 'https://picsum.photos/seed/110/200/200', xp: 10000 },
  { userId: 'user-11', name: 'Sam Smith', email: 'sam.sw@autodrive.com', role: 'Service Writer', dealershipId: 'dealership-A', avatarUrl: 'https://picsum.photos/seed/111/200/200', xp: 150 },
  { userId: 'user-12', name: 'Travis Trainer', email: 'trainer@autoknerd.com', role: 'Trainer', dealershipId: 'dealership-A', avatarUrl: 'https://picsum.photos/seed/112/200/200', xp: 15000 },
  { userId: 'user-13', name: 'Andy Admin', email: 'admin@autoknerd.com', role: 'Admin', dealershipId: 'autoknerd-hq', avatarUrl: 'https://picsum.photos/seed/113/200/200', xp: 20000 },
  { userId: 'user-14', name: 'Manager B', email: 'manager.b@autodrive.com', role: 'manager', dealershipId: 'dealership-B', avatarUrl: 'https://picsum.photos/seed/114/200/200', xp: 4500 },
  { userId: 'user-15', name: 'Consultant B1', email: 'consultant.b1@autodrive.com', role: 'consultant', dealershipId: 'dealership-B', avatarUrl: 'https://picsum.photos/seed/115/200/200', xp: 30 },
];

const lessons: Lesson[] = [
    { lessonId: 'lesson-101', title: 'Mastering the Walk-around', role: 'consultant', category: 'Sales - Vehicle Presentation', associatedTrait: 'relationshipBuilding' },
    { lessonId: 'lesson-102', title: 'Advanced Closing Techniques', role: 'consultant', category: 'Sales - Closing', associatedTrait: 'closing' },
    { lessonId: 'lesson-103', title: 'EV Model Lineup 2024', role: 'consultant', category: 'Product Knowledge', associatedTrait: 'trust' },
    { lessonId: 'lesson-104', title: 'Handling Difficult Customers', role: 'consultant', category: 'Sales - Needs Assessment', associatedTrait: 'empathy' },
    { lessonId: 'lesson-105', title: 'Active Listening for Customer Needs', role: 'consultant', category: 'Sales - Needs Assessment', associatedTrait: 'listening' },
    { lessonId: 'lesson-106', title: 'Effective Post-Sale Follow Up', role: 'consultant', category: 'Sales - Follow-up', associatedTrait: 'followUp' },
    { lessonId: 'lesson-201', title: 'Coaching on Listening Skills', role: 'manager', category: 'Sales - Needs Assessment', associatedTrait: 'listening' },
    { lessonId: 'lesson-202', title: 'Training Trainers', role: 'Trainer', category: 'Sales - Needs Assessment', associatedTrait: 'empathy' },
    { lessonId: 'lesson-301', title: 'Effective Service Write-ups', role: 'Service Writer', category: 'Service - Write-up', associatedTrait: 'listening' },
    { lessonId: 'lesson-302', title: 'Managing Shop Workflow for Better Follow-Up', role: 'Service Manager', category: 'Service - Status Updates', associatedTrait: 'followUp' },
    { lessonId: 'lesson-401', title: 'Building Trust in F&I', role: 'Finance Manager', category: 'F&I - Menu Selling', associatedTrait: 'trust' },
    { lessonId: 'lesson-501', title: 'Finding the Right Part Through Better Questions', role: 'Parts Consultant', category: 'Parts - Identifying Needs', associatedTrait: 'listening' },
    { lessonId: 'lesson-502', title: 'Inventory Management for Timely Deliveries', role: 'Parts Manager', category: 'Parts - Sourcing', associatedTrait: 'followUp' },
];

const lessonLogs: LessonLog[] = [
  { logId: 'log-1', timestamp: new Date('2024-05-20T10:00:00Z'), userId: 'user-1', lessonId: 'lesson-101', stepResults: { step1: 'pass', step2: 'pass' }, xpGained: 100, empathy: 85, listening: 90, trust: 80, followUp: 75, closing: 70, relationshipBuilding: 88, isRecommended: true },
  { logId: 'log-2', timestamp: new Date('2024-05-21T11:30:00Z'), userId: 'user-1', lessonId: 'lesson-103', stepResults: { step1: 'pass' }, xpGained: 120, empathy: 88, listening: 92, trust: 82, followUp: 78, closing: 72, relationshipBuilding: 90, isRecommended: false },
  { logId: 'log-3', timestamp: new Date('2024-05-22T09:00:00Z'), userId: 'user-3', lessonId: 'lesson-101', stepResults: { step1: 'pass', step2: 'fail' }, xpGained: 50, empathy: 70, listening: 65, trust: 75, followUp: 60, closing: 55, relationshipBuilding: 72, isRecommended: true },
  { logId: 'log-4', timestamp: new Date('2024-05-23T14:00:00Z'), userId: 'user-12', lessonId: 'lesson-202', stepResults: { step1: 'pass' }, xpGained: 75, empathy: 90, listening: 85, trust: 88, followUp: 82, closing: 80, relationshipBuilding: 92, isRecommended: false },
  { logId: 'log-5', timestamp: new Date('2024-05-24T10:00:00Z'), userId: 'user-4', lessonId: 'lesson-104', stepResults: { step1: 'pass' }, xpGained: 90, empathy: 90, listening: 80, trust: 85, followUp: 88, closing: 82, relationshipBuilding: 87, isRecommended: true },
  { logId: 'log-6', timestamp: new Date('2024-05-25T11:30:00Z'), userId: 'user-15', lessonId: 'lesson-101', stepResults: { step1: 'fail' }, xpGained: 30, empathy: 60, listening: 55, trust: 65, followUp: 70, closing: 50, relationshipBuilding: 62, isRecommended: true },
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

// LESSONS
export async function getLessons(role: LessonRole): Promise<Lesson[]> {
    await simulateNetworkDelay();
    return lessons.filter(l => l.role === role);
}

export async function getLessonById(lessonId: string): Promise<Lesson | null> {
    await simulateNetworkDelay();
    return lessons.find(l => l.lessonId === lessonId) || null;
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
    const validRoles: UserRole[] = ['consultant', 'manager', 'Service Writer', 'Service Manager', 'Finance Manager', 'Parts Consultant', 'Parts Manager', 'Trainer'];
    
    if (lessonData.targetRole === 'global') {
        rolesToCreate.push(...validRoles as LessonRole[]);
    } else if (validRoles.includes(lessonData.targetRole)) {
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
            return ['consultant'];
        case 'Service Manager':
            return ['Service Writer'];
        case 'Parts Manager':
            return ['Parts Consultant'];
        case 'Owner':
             const ownerRoles = users.filter(u => u.role !== 'Owner' && u.role !== 'Admin').map(u => u.role)
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

export async function getDealerships(): Promise<string[]> {
    await simulateNetworkDelay();
    const dealershipIds = users.map(u => u.dealershipId).filter(id => id !== 'autoknerd-hq');
    return [...new Set(dealershipIds)];
}

export async function getManagerStats(dealershipId: string, userRole: UserRole): Promise<{ totalLessons: number; avgEmpathy: number }> {
    await simulateNetworkDelay();

    const teamRoles = getTeamMemberRoles(userRole);
    
    let relevantLogs: LessonLog[];

    if ((['Owner', 'Admin', 'Trainer'].includes(userRole)) && dealershipId === 'all') {
        // All users except other owners/admins
        const teamUserIds = users.filter(u => !['Owner', 'Admin', 'Trainer'].includes(u.role)).map(u => u.userId);
        relevantLogs = lessonLogs.filter(log => teamUserIds.includes(log.userId));
    } else {
        const teamUserIds = users
            .filter(u => u.dealershipId === dealershipId && teamRoles.includes(u.role))
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
             // For Admin/Owner 'all', get all manageable users across all dealerships
            teamMembers = users.filter(u => teamRoles.includes(u.role));
        } else {
            // For Admin/Owner single dealership view
            teamMembers = users.filter(u => u.dealershipId === dealershipId && teamRoles.includes(u.role));
        }
    } else {
         // For other managers, scope to their dealership
         teamMembers = users.filter(u => u.dealershipId === dealershipId && teamRoles.includes(u.role));
    }
    
    const activity = teamMembers.map(member => {
        const memberLogs = lessonLogs.filter(log => log.userId === member.userId);
        if (memberLogs.length === 0) {
            return { consultant: member, lessonsCompleted: 0, totalXp: 0, avgScore: 0 };
        }

        const lessonsCompleted = memberLogs.length;
        const totalXp = memberLogs.reduce((sum, log) => sum + log.xpGained, 0);
        
        const totalScore = memberLogs.reduce((sum, log) => {
            return sum + (log.empathy + log.listening + log.trust + log.followUp + log.closing + log.relationshipBuilding);
        }, 0);
        
        const avgScore = Math.round(totalScore / (memberLogs.length * 6));

        return { consultant: member, lessonsCompleted, totalXp, avgScore };
    });

    return activity.sort((a, b) => b.totalXp - a.totalXp);
}


export async function registerDealership(dealershipName: string, userEmail: string, role: UserRole): Promise<{ activationCode: string; uses: number; }> {
    await simulateNetworkDelay();

    if (users.some(u => u.email.toLowerCase() === userEmail.toLowerCase())) {
        throw new Error("An account with this email already exists.");
    }
    const dealershipId = dealershipName.toLowerCase().replace(/\s+/g, '-');
    if (users.some(u => u.dealershipId === dealershipId)) {
        // In a real app, you might want to handle this differently, but for mock data this is fine.
    }

    const newUserId = `user-${users.length + 1}`;
    const activationCode = Math.random().toString(36).slice(2, 10).toUpperCase();

    const newUser: User = {
        userId: newUserId,
        name: 'New User', // Default name
        email: userEmail,
        role: role,
        dealershipId: dealershipId,
        avatarUrl: `https://picsum.photos/seed/${newUserId}/200/200`,
        xp: 0,
    };

    users.push(newUser);
    
    let uses = 30; // Default for other roles
    if (role === 'Owner') {
        uses = 1;
    } else if (['manager', 'Service Manager', 'Parts Manager', 'Finance Manager'].includes(role)) {
        uses = 10;
    }

    console.log(`Registered new dealership: ${dealershipName} (${dealershipId})`);
    console.log(`New ${role}: ${userEmail} with activation code: ${activationCode} (${uses} uses)`);

    return { activationCode, uses };
}
