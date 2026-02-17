
import { User, Dealership, LessonLog, UserRole, Badge, EarnedBadge, Lesson, LessonAssignment, CxTrait } from './definitions';
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

type DealershipPersonality = {
    strongSuit: CxTrait;
    weakSuit: CxTrait;
};

const dealershipPersonalities: Record<string, DealershipPersonality> = {
    "tour-dealership-1": { strongSuit: 'relationshipBuilding', weakSuit: 'closing' }, // Prestige Auto Group
    "tour-dealership-2": { strongSuit: 'closing', weakSuit: 'empathy' },             // Velocity Motors
    "tour-dealership-3": { strongSuit: 'trust', weakSuit: 'followUp' },              // Summit Cars
    "tour-dealership-4": { strongSuit: 'listening', weakSuit: 'relationshipBuilding' }, // Coastal Drive
};

const generateRandomScore = (base: number, bias: 'strong' | 'weak' | 'neutral' = 'neutral') => {
    let score;
    if (bias === 'strong') {
        score = base + 15 + Math.floor(Math.random() * 15); // Biased to be higher
    } else if (bias === 'weak') {
        score = base - 25 + Math.floor(Math.random() * 15); // Biased to be lower
    } else { // neutral
        score = base + Math.floor(Math.random() * 20) - 10;
    }
    return Math.min(99, Math.max(40, Math.round(score)));
};

type TourData = {
    dealerships: Dealership[];
    users: User[];
    lessonLogs: LessonLog[];
    earnedBadges: Record<string, EarnedBadge[]>;
    lessons: Lesson[];
    lessonAssignments: LessonAssignment[];
};

let tourDataPromise: Promise<TourData> | null = null;

const generateTourDataInternal = (): Promise<TourData> => {
    return new Promise(resolve => {
        const dealerships: Dealership[] = [];
        const users: User[] = [];
        const lessonLogs: LessonLog[] = [];
        const earnedBadges: Record<string, EarnedBadge[]> = {};
        const lessonAssignments: LessonAssignment[] = [];

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
        
        const lessons: Lesson[] = [
            {
                lessonId: 'tour-lesson-1',
                title: 'Building Rapport on the Lot',
                role: 'Sales Consultant',
                category: 'Sales - Meet and Greet',
                associatedTrait: 'relationshipBuilding',
                customScenario: 'A customer has been looking at a new SUV for about 5 minutes. They seem interested but also a little hesitant to engage. How do you approach them without being pushy?'
            },
            {
                lessonId: 'tour-lesson-2',
                title: 'Uncovering Customer Needs',
                role: 'Sales Consultant',
                category: 'Sales - Needs Assessment',
                associatedTrait: 'listening',
                customScenario: 'A couple comes in saying they "need a safe family car." That\'s a very broad statement. What questions do you ask to truly understand their specific needs and priorities?'
            },
            {
                lessonId: 'tour-lesson-3',
                title: 'Handling Price Objections',
                role: 'Sales Consultant',
                category: 'Sales - Negotiation',
                associatedTrait: 'trust',
                customScenario: 'After a test drive, the customer loves the car but says, "Your competitor down the street offered me the same model for $1,500 less." How do you respond while holding value in your dealership\'s offer?'
            },
            {
                lessonId: 'tour-lesson-4',
                title: 'Confident Closing',
                role: 'Sales Consultant',
                category: 'Sales - Closing',
                associatedTrait: 'closing',
                customScenario: 'The customer is on the fence. They\'ve agreed the car meets their needs and the price is fair, but they say "I need to think about it." What techniques can you use to create urgency and close the deal today?'
            },
            {
                lessonId: 'tour-lesson-5',
                title: 'The Perfect Service Greeting',
                role: 'Service Writer',
                category: 'Service - Write-up',
                associatedTrait: 'empathy',
                customScenario: 'A customer pulls into the service drive. They look visibly stressed and are in a hurry. What are the first three things you say and do to de-escalate the situation and start the visit off right?'
            },
            {
                lessonId: 'tour-lesson-6',
                title: 'Presenting the MPI with Confidence',
                role: 'Service Writer',
                category: 'Service - Presenting MPI',
                associatedTrait: 'trust',
                customScenario: 'Your technician found an additional issue during the multi-point inspection. The customer only came in for an oil change. How do you present the recommended service without sounding like you\'re just trying to upsell them?'
            },
            {
                lessonId: 'tour-lesson-7',
                title: 'Coaching for Performance',
                role: 'manager',
                category: 'Management - Coaching',
                associatedTrait: 'relationshipBuilding',
                customScenario: 'One of your sales consultants has had a great month, but their "listening" score in AutoDrive is consistently low. How do you approach this coaching conversation to be effective and not discouraging?'
            },
            {
                lessonId: 'tour-lesson-8',
                title: 'Driving a High-Performance Culture',
                role: 'General Manager',
                category: 'Leadership - Team Motivation',
                associatedTrait: 'relationshipBuilding',
                customScenario: 'It\'s the middle of the month and sales are tracking below forecast. The team seems a bit demoralized. What actions can you take in the next 24 hours to re-energize the sales floor and service drive?'
            },
            {
                lessonId: 'tour-lesson-9',
                title: 'Service Follow-up Excellence',
                role: 'global',
                category: 'Service - Follow-up',
                associatedTrait: 'followUp',
                customScenario: 'A customer had a significant repair done on their vehicle last week. What does a world-class follow-up call sound like a few days later?'
            }
        ];

        // 2. Generate Users, including specific ones for the demo logins
        const specificTourUsers: User[] = [
            {
                userId: 'tour-owner',
                name: 'Demo Owner',
                email: 'owner.demo@autodrive.com',
                role: 'Owner',
                dealershipIds: dealerships.map(d => d.id),
                avatarUrl: 'https://i.pravatar.cc/150?u=tour-owner',
                xp: 25000,
                isPrivate: false,
                isPrivateFromOwner: false,
                showDealerCriticalOnly: false,
                memberSince: new Date(new Date().getTime() - 365 * 2 * 24 * 60 * 60 * 1000).toISOString(),
                subscriptionStatus: 'active'
            },
            {
                userId: 'tour-manager',
                name: 'Demo Sales Manager',
                email: 'manager.demo@autodrive.com',
                role: 'manager',
                dealershipIds: [dealerships[0].id],
                avatarUrl: 'https://i.pravatar.cc/150?u=tour-manager',
                xp: 12500,
                isPrivate: false,
                isPrivateFromOwner: false,
                showDealerCriticalOnly: false,
                memberSince: new Date(new Date().getTime() - 200 * 24 * 60 * 60 * 1000).toISOString(),
                subscriptionStatus: 'active'
            },
            {
                userId: 'tour-consultant',
                name: 'Demo Sales Consultant',
                email: 'consultant.demo@autodrive.com',
                role: 'Sales Consultant',
                dealershipIds: [dealerships[0].id],
                avatarUrl: 'https://i.pravatar.cc/150?u=tour-consultant',
                xp: 4200,
                isPrivate: false,
                isPrivateFromOwner: false,
                showDealerCriticalOnly: false,
                memberSince: new Date(new Date().getTime() - 100 * 24 * 60 * 60 * 1000).toISOString(),
                subscriptionStatus: 'active'
            },
            {
                userId: 'tour-service-writer',
                name: 'Demo Service Writer',
                email: 'service.writer.demo@autodrive.com',
                role: 'Service Writer',
                dealershipIds: [dealerships[1].id],
                avatarUrl: 'https://i.pravatar.cc/150?u=tour-service-writer',
                xp: 5800,
                isPrivate: false,
                isPrivateFromOwner: false,
                showDealerCriticalOnly: false,
                memberSince: new Date(new Date().getTime() - 150 * 24 * 60 * 60 * 1000).toISOString(),
                subscriptionStatus: 'active'
            },
            {
                userId: 'tour-parts-consultant',
                name: 'Demo Parts Consultant',
                email: 'parts.consultant.demo@autodrive.com',
                role: 'Parts Consultant',
                dealershipIds: [dealerships[2].id],
                avatarUrl: 'https://i.pravatar.cc/150?u=tour-parts-consultant',
                xp: 3900,
                isPrivate: false,
                isPrivateFromOwner: false,
                showDealerCriticalOnly: false,
                memberSince: new Date(new Date().getTime() - 120 * 24 * 60 * 60 * 1000).toISOString(),
                subscriptionStatus: 'active'
            },
            {
                userId: 'tour-finance-manager',
                name: 'Demo Finance Manager',
                email: 'finance.manager.demo@autodrive.com',
                role: 'Finance Manager',
                dealershipIds: [dealerships[0].id],
                avatarUrl: 'https://i.pravatar.cc/150?u=tour-finance-manager',
                xp: 7600,
                isPrivate: false,
                isPrivateFromOwner: false,
                showDealerCriticalOnly: false,
                memberSince: new Date(new Date().getTime() - 175 * 24 * 60 * 60 * 1000).toISOString(),
                subscriptionStatus: 'active'
            },
            {
                userId: 'tour-service-manager',
                name: 'Demo Service Manager',
                email: 'service.manager.demo@autodrive.com',
                role: 'Service Manager',
                dealershipIds: [dealerships[1].id],
                avatarUrl: 'https://i.pravatar.cc/150?u=tour-service-manager',
                xp: 9800,
                isPrivate: false,
                isPrivateFromOwner: false,
                showDealerCriticalOnly: false,
                memberSince: new Date(new Date().getTime() - 220 * 24 * 60 * 60 * 1000).toISOString(),
                subscriptionStatus: 'active'
            },
            {
                userId: 'tour-parts-manager',
                name: 'Demo Parts Manager',
                email: 'parts.manager.demo@autodrive.com',
                role: 'Parts Manager',
                dealershipIds: [dealerships[2].id],
                avatarUrl: 'https://i.pravatar.cc/150?u=tour-parts-manager',
                xp: 9100,
                isPrivate: false,
                isPrivateFromOwner: false,
                showDealerCriticalOnly: false,
                memberSince: new Date(new Date().getTime() - 260 * 24 * 60 * 60 * 1000).toISOString(),
                subscriptionStatus: 'active'
            },
            {
                userId: 'tour-general-manager',
                name: 'Demo General Manager',
                email: 'general.manager.demo@autodrive.com',
                role: 'General Manager',
                dealershipIds: [dealerships[0].id, dealerships[1].id],
                avatarUrl: 'https://i.pravatar.cc/150?u=tour-general-manager',
                xp: 14300,
                isPrivate: false,
                isPrivateFromOwner: false,
                showDealerCriticalOnly: false,
                memberSince: new Date(new Date().getTime() - 300 * 24 * 60 * 60 * 1000).toISOString(),
                subscriptionStatus: 'active'
            }
        ];

        users.push(...specificTourUsers);

        // Generate random users for team views
        for (const dealership of dealerships) {
            const personality = dealershipPersonalities[dealership.id];

            for (let i = 0; i < 5; i++) {
                const role: UserRole = i < 3 ? 'Sales Consultant' : 'Service Writer';
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
                    showDealerCriticalOnly: Math.random() > 0.75,
                    memberSince: new Date(new Date().getTime() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString(),
                    subscriptionStatus: 'active'
                };
                users.push(user);
            }
        }


        // Generate logs and badges for all created users
        for (const user of users) {
            earnedBadges[user.userId] = [];
            const numLogs = user.xp > 0 ? Math.floor(user.xp / (Math.floor(Math.random() * 40) + 40)) : Math.floor(Math.random() * 8) + 2;
            let totalXp = 0;

            const personality = user.dealershipIds.length > 0 ? dealershipPersonalities[user.dealershipIds[0]] : null;

            for (let j = 0; j < numLogs; j++) {
                const xpGained = Math.floor(Math.random() * 90) + 10;
                totalXp += xpGained;
                const scores: Partial<Record<CxTrait, number>> = {};
                const traits: CxTrait[] = ['empathy', 'listening', 'trust', 'followUp', 'closing', 'relationshipBuilding'];
                const baseScores: Record<CxTrait, number> = { empathy: 75, listening: 70, trust: 80, followUp: 65, closing: 68, relationshipBuilding: 82 };

                traits.forEach(trait => {
                    let bias: 'strong' | 'weak' | 'neutral' = 'neutral';
                    if (personality && personality.strongSuit === trait) bias = 'strong';
                    else if (personality && personality.weakSuit === trait) bias = 'weak';
                    scores[trait] = generateRandomScore(baseScores[trait], bias);
                });

                lessonLogs.push({
                    logId: `tour-log-${user.userId}-${j}`,
                    timestamp: new Date(new Date().getTime() - Math.random() * 90 * 24 * 60 * 60 * 1000),
                    userId: user.userId,
                    lessonId: `tour-lesson-${(j % 9) + 1}`,
                    stepResults: { final: 'pass' },
                    xpGained: xpGained,
                    empathy: scores.empathy!, listening: scores.listening!, trust: scores.trust!, followUp: scores.followUp!, closing: scores.closing!, relationshipBuilding: scores.relationshipBuilding!,
                    isRecommended: Math.random() > 0.7
                });
            }
            if (user.xp === 0) user.xp = totalXp;

            if (user.xp > 1000) earnedBadges[user.userId].push({ badgeId: 'xp-1000', userId: user.userId, timestamp: new Date() });
            if (user.xp > 5000) earnedBadges[user.userId].push({ badgeId: 'xp-5000', userId: user.userId, timestamp: new Date() });
            if (calculateLevel(user.xp).level >= 10) earnedBadges[user.userId].push({ badgeId: 'level-10', userId: user.userId, timestamp: new Date() });
            if (calculateLevel(user.xp).level >= 25) earnedBadges[user.userId].push({ badgeId: 'level-25', userId: user.userId, timestamp: new Date() });
            if (Math.random() > 0.8) earnedBadges[user.userId].push({ badgeId: 'top-performer', userId: user.userId, timestamp: new Date() });
        }
        
        // Add specific badges for the Owner tour user
        const ownerUserId = 'tour-owner';
        earnedBadges[ownerUserId] = [
            { badgeId: 'talent-scout', userId: ownerUserId, timestamp: new Date() },
            { badgeId: 'curriculum-architect', userId: ownerUserId, timestamp: new Date() },
            { badgeId: 'empire-builder', userId: ownerUserId, timestamp: new Date() },
            { badgeId: 'xp-10000', userId: ownerUserId, timestamp: new Date() },
            { badgeId: 'level-25', userId: ownerUserId, timestamp: new Date() },
        ];
        
        resolve({ dealerships, users, lessonLogs, earnedBadges, lessons, lessonAssignments });
    });
};

export const generateTourData = async (): Promise<TourData> => {
  if (!tourDataPromise) {
    tourDataPromise = generateTourDataInternal();
  }
  return tourDataPromise;
};
