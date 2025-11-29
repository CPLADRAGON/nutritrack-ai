import React, { useState } from 'react';
import { ActivityLevel, GoalType, UserProfile } from '../types';
import { generatePlanFromProfile } from '../services/geminiService';

interface ProfileSetupProps {
  onComplete: (profile: UserProfile) => void;
  onCancel: () => void;
}

export const ProfileSetup: React.FC<ProfileSetupProps> = ({ onComplete, onCancel }) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    age: 25,
    gender: 'MALE',
    height: 170,
    weight: 70,
    activityLevel: ActivityLevel.SEDENTARY,
    goal: GoalType.LOSE_WEIGHT
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // 1. Get AI recommendations
      const plan = await generatePlanFromProfile(formData as any);

      // 2. Construct full profile
      const newProfile: UserProfile = {
        id: Date.now().toString(),
        name: formData.name,
        age: Number(formData.age),
        gender: formData.gender as 'MALE' | 'FEMALE',
        height: Number(formData.height),
        weight: Number(formData.weight),
        activityLevel: formData.activityLevel,
        goal: formData.goal,
        tdee: plan.tdee, // Save TDEE
        targetCalories: plan.targetCalories,
        targetProtein: plan.targetProtein,
        targetCarbs: plan.targetCarbs,
        targetFat: plan.targetFat,
        // Use Singapore time for the record creation date
        createdAt: new Date().toLocaleString('en-US', { timeZone: 'Asia/Singapore' })
      };

      onComplete(newProfile);
    } catch (error) {
      alert("Failed to generate plan. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const inputClass = "mt-1 block w-full rounded-md border-gray-300 shadow-sm border p-2 focus:ring-primary focus:border-primary bg-white text-gray-900";

  return (
    <div className="max-w-lg mx-auto bg-white p-8 rounded-2xl shadow-lg mt-10">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Welcome to NutriTrack</h2>
        <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 text-sm">Cancel</button>
      </div>
      <p className="text-gray-500 mb-6">Let's calculate your personalized nutrition plan.</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Name</label>
          <input required name="name" type="text" value={formData.name} onChange={handleChange} className={inputClass} placeholder="Enter your name" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Age</label>
            <input required name="age" type="number" value={formData.age} onChange={handleChange} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Gender</label>
            <select name="gender" value={formData.gender} onChange={handleChange} className={inputClass}>
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Height (cm)</label>
            <input required name="height" type="number" value={formData.height} onChange={handleChange} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Weight (kg)</label>
            <input required name="weight" type="number" value={formData.weight} onChange={handleChange} className={inputClass} />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Activity Level</label>
          <select name="activityLevel" value={formData.activityLevel} onChange={handleChange} className={inputClass}>
            {Object.values(ActivityLevel).map(level => (
              <option key={level} value={level}>{level.replace('_', ' ')}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Goal</label>
          <select name="goal" value={formData.goal} onChange={handleChange} className={inputClass}>
            {Object.values(GoalType).map(goal => (
              <option key={goal} value={goal}>{goal.replace('_', ' ')}</option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-emerald-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50"
        >
          {loading ? 'Analyzing with AI...' : 'Create Profile'}
        </button>
      </form>
    </div>
  );
};