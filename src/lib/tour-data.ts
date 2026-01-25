
'use client';

import { User, Dealership, LessonLog, UserRole, Badge, EarnedBadge, Lesson } from './definitions';
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
                    lessonId: `tour-lesson-${(j % 9) + 1}`,
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
    
    return { dealerships, users, lessonLogs, earnedBadges, lessons };
};
