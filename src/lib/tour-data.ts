
'use client';

import { User, Dealership, LessonLog, UserRole, Badge, EarnedBadge } from './definitions';
import { calculateLevel } from './xp';
import { allBadges }from './badges';

const dealershipNames = [
    "Prestige Auto Group",
    "Velocity Motors",
    "Summit Cars",
    "Coastal Drive Dealership"
];

const firstNames = ["Alex", "Jordan", "Taylor", "Morgan", "Casey", "Riley", "Jamie", "Skyler", "Dakota", "Rowan", "Avery", "Peyton", "Cameron", "Jesse", "Drew"];
const lastNames = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson"];

const generateRandomName = () => `${firstNames[Math.floor(Math.random() * firstNames.length)]} ${lastNames[Math.floor(Math.random() * lastNames.length)]}`;

const generateRandomEmail = (name: string) => `${name.toLowerCase().replace(/ /g, '.').substring(0,15)}${Math.floor(Math.random() * 100)}@autodrive-demo.com`;

const generateRandomScore = (base: number) => Math.min(100, Math.max(40, base + Math.floor(Math.random() * 40) - 20));

export const generateTourData = () => {
    const dealerships: Dealership[] = [];
    const users: User[] = [];
    const lessonLogs: LessonLog[] = [];
    const earnedBadges: Record<string, EarnedBadge[]> = {};

    // 1. Generate Dealerships
    for (let i = 0; i < 4; i++) {
        dealerships.push({
            id: `tour-dealership-${i + 1}`,
            name: dealershipNames[i],
            status: 'active',
            address: {
                street: `${100 + i} Tour Ave`,
                city: "DemoCity",
                state: "DS",
                zip: `${10000 + i}`
            }
        });
    }

    // 2. Generate Users
    const rolesToGenerate: UserRole[] = [
        'manager', 'Service Manager', 'Parts Manager', 'Finance Manager',
        'Sales Consultant', 'Sales Consultant', 'Sales Consultant', 'Sales Consultant', 'Sales Consultant',
        'Service Writer', 'Service Writer', 'Service Writer',
        'Parts Consultant', 'Parts Consultant', 'Sales Consultant'
    ]; 

    for (const dealership of dealerships) {
        for (let i = 0; i < 15; i++) { // 15 users per dealership = 60 total
            const role = rolesToGenerate[i % rolesToGenerate.length];
            const name = generateRandomName();
            const user: User = {
                userId: `tour-user-${dealership.id}-${i}`,
                name: name,
                email: generateRandomEmail(name),
                role: role,
                dealershipIds: [dealership.id],
                avatarUrl: `https://i.pravatar.cc/150?u=tour-user-${dealership.id}-${i}`,
                xp: 0,
                isPrivate: Math.random() > 0.8,
                isPrivateFromOwner: Math.random() > 0.9,
                memberSince: new Date(new Date().getTime() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString(),
                subscriptionStatus: 'active'
            };

            // 3. Generate Lesson Logs for each user
            const numLogs = Math.floor(Math.random() * 25) + 5;
            let totalXp = 0;
            for (let j = 0; j < numLogs; j++) {
                const xpGained = Math.floor(Math.random() * 90) + 10;
                totalXp += xpGained;

                const log: LessonLog = {
                    logId: `tour-log-${user.userId}-${j}`,
                    timestamp: new Date(new Date().getTime() - Math.random() * 90 * 24 * 60 * 60 * 1000),
                    userId: user.userId,
                    lessonId: `lesson-id-${j % 5}`,
                    stepResults: { final: 'pass' },
                    xpGained: xpGained,
                    empathy: generateRandomScore(75),
                    listening: generateRandomScore(70),
                    trust: generateRandomScore(80),
                    followUp: generateRandomScore(65),
                    closing: generateRandomScore(68),
                    relationshipBuilding: generateRandomScore(82),
                    isRecommended: Math.random() > 0.7
                };
                lessonLogs.push(log);
            }
            user.xp = totalXp;
            
            // 4. Generate some badges for the user
            earnedBadges[user.userId] = [];
            if (user.xp > 1000) earnedBadges[user.userId].push({ badgeId: 'xp-1000', userId: user.userId, timestamp: new Date() });
            if (user.xp > 5000) earnedBadges[user.userId].push({ badgeId: 'xp-5000', userId: user.userId, timestamp: new Date() });
            if (calculateLevel(user.xp).level >= 10) earnedBadges[user.userId].push({ badgeId: 'level-10', userId: user.userId, timestamp: new Date() });
            if (calculateLevel(user.xp).level >= 25) earnedBadges[user.userId].push({ badgeId: 'level-25', userId: user.userId, timestamp: new Date() });
            if (Math.random() > 0.8) earnedBadges[user.userId].push({ badgeId: 'top-performer', userId: user.userId, timestamp: new Date() });


            users.push(user);
        }
    }
    
    return { dealerships, users, lessonLogs, earnedBadges };
};
