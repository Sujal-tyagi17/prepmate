import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        return NextResponse.json({
            success: true,
            user: {
                id: user.id,
                clerkId: user.clerk_id,
                name: user.name,
                email: user.email,
                image: user.image,
                bio: user.bio,
                defaultDifficulty: user.default_difficulty,
                defaultDuration: user.default_duration,
                totalInterviews: user.total_interviews,
                averageScore: user.average_score,
                focusAreas: user.focus_areas || [],
                notificationReminders: user.notification_reminders,
                notificationScoreUpdates: user.notification_score_updates,
                notificationNewFeatures: user.notification_new_features,
                notificationTips: user.notification_tips,
                voiceSpeed: user.voice_speed,
                strictMode: user.strict_mode,
                createdAt: user.created_at,
            },
        });
    } catch (error) {
        console.error("Error fetching profile:", error);
        return NextResponse.json({ error: "Failed to fetch profile" }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const body = await req.json();
        const { 
            name, 
            bio, 
            defaultDifficulty, 
            defaultDuration, 
            image,
            focusAreas,
            notificationReminders,
            notificationScoreUpdates,
            notificationNewFeatures,
            notificationTips,
            voiceSpeed,
            strictMode
        } = body;

        const supabase = createClient();
        
        const updates: any = {};
        if (name) updates.name = name;
        if (bio !== undefined) updates.bio = bio;
        if (defaultDifficulty) updates.default_difficulty = defaultDifficulty;
        if (defaultDuration) updates.default_duration = Math.min(30, Math.max(5, Number(defaultDuration)));
        if (image) updates.image = image;
        if (focusAreas !== undefined) updates.focus_areas = focusAreas;
        if (notificationReminders !== undefined) updates.notification_reminders = notificationReminders;
        if (notificationScoreUpdates !== undefined) updates.notification_score_updates = notificationScoreUpdates;
        if (notificationNewFeatures !== undefined) updates.notification_new_features = notificationNewFeatures;
        if (notificationTips !== undefined) updates.notification_tips = notificationTips;
        if (voiceSpeed !== undefined) updates.voice_speed = voiceSpeed;
        if (strictMode !== undefined) updates.strict_mode = strictMode;

        const { data: updatedUser, error } = await supabase
            .from('users')
            .update(updates)
            .eq('clerk_id', user.clerk_id)
            .select()
            .single();

        if (error) {
            console.error("Error updating profile:", error);
            return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
        }

        return NextResponse.json({ success: true, user: updatedUser });
    } catch (error) {
        console.error("Error updating profile:", error);
        return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
    }
}
