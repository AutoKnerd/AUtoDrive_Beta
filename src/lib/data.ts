import type { User, Lesson, LessonLog } from './definitions';

// --- MOCK DATABASE ---

const users: User[] = [
  { userId: 'user-1', name: 'Alice Johnson', email: 'consultant@autodrive.com', role: 'consultant', dealershipId: 'dealership-A', avatarUrl: 'https://picsum.photos/seed/101/200/200' },
  { userId: 'user-2', name: 'Bob Williams', email: 'manager@autodrive.com', role: 'manager', dealershipId: 'dealership-A', avatarUrl: 'https://picsum.photos/seed/102/200/200' },
  { userId: 'user-3', name: 'Charlie Brown', email: 'charlie@autodrive.com', role: 'consultant', dealershipId: 'dealership-A', avatarUrl: 'https://picsum.photos/seed/103/200/200' },
  { userId: 'user-4', name: 'Diana Prince', email: 'diana@autodrive.com', role: 'consultant', dealershipId: 'dealership-B', avatarUrl: 'https://picsum.photos/seed/104/200/200' },
];

const lessons: Lesson[] = [
  { lessonId: 'lesson-101', title: 'Mastering the Walk-around', role: 'consultant', category: 'Sales Process' },
  { lessonId: 'lesson-102', title: 'Advanced Closing Techniques', role: 'consultant', category: 'Sales Process' },
  { lessonId: 'lesson-103', title: 'EV Model Lineup 2024', role: 'consultant', category: 'Product Knowledge' },
  { lessonId: 'lesson-104', title: 'Handling Difficult Customers', role: 'consultant', category: 'Customer Service' },
  { lessonId: 'lesson-201', title: 'Conducting Performance Reviews', role: 'manager', category: 'Sales Process' },
];

const lessonLogs: LessonLog[] = [
  { logId: 'log-1', timestamp: new Date('2024-05-20T10:00:00Z'), userId: 'user-1', lessonId: 'lesson-101', stepResults: { step1: 'pass', step2: 'pass' }, xpGained: 100, empathy: 85, listening: 90, trust: 80, followUp: 75, closing: 70, relationshipBuilding: 88 },
  { logId: 'log-2', timestamp: new Date('2024-05-21T11:30:00Z'), userId: 'user-1', lessonId: 'lesson-103', stepResults: { step1: 'pass' }, xpGained: 120, empathy: 88, listening: 92, trust: 82, followUp: 78, closing: 72, relationshipBuilding: 90 },
  { logId: 'log-3', timestamp: new Date('2024-05-22T09:00:00Z'), userId: 'user-3', lessonId: 'lesson-101', stepResults: { step1: 'pass', step2: 'fail' }, xpGained: 50, empathy: 70, listening: 65, trust: 75, followUp: 60, closing: 55, relationshipBuilding: 72 },
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

// CONSULTANT
export async function getLessons(role: 'consultant' | 'manager'): Promise<Lesson[]> {
    await simulateNetworkDelay();
    return lessons.filter(l => l.role === role);
}

export async function getConsultantActivity(userId: string): Promise<LessonLog[]> {
    await simulateNetworkDelay();
    return lessonLogs.filter(log => log.userId === userId).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
}

// MANAGER
export async function getManagerStats(dealershipId: string): Promise<{ totalLessons: number; avgEmpathy: number }> {
    await simulateNetworkDelay();
    const dealershipUserIds = users.filter(u => u.dealershipId === dealershipId && u.role === 'consultant').map(u => u.userId);
    const dealershipLogs = lessonLogs.filter(log => dealershipUserIds.includes(log.userId));
    
    if (dealershipLogs.length === 0) {
        return { totalLessons: 0, avgEmpathy: 0 };
    }

    const totalLessons = dealershipLogs.length;
    const totalEmpathy = dealershipLogs.reduce((sum, log) => sum + log.empathy, 0);
    const avgEmpathy = Math.round(totalEmpathy / totalLessons);

    return { totalLessons, avgEmpathy };
}

export async function getTeamActivity(dealershipId: string): Promise<{ consultant: User; lessonsCompleted: number; totalXp: number; avgScore: number; }[]> {
    await simulateNetworkDelay();
    const teamMembers = users.filter(u => u.dealershipId === dealershipId && u.role === 'consultant');
    
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

    return activity;
}
