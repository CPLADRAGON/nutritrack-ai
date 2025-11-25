import React, { useState, useRef, useEffect } from 'react';
import { UserProfile, MealLog, WeightLog, MealType } from '../types';
import { analyzeFoodImage, getDailyAdvice, getFoodSuggestion } from '../services/geminiService';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  LineChart, Line
} from 'recharts';

interface DashboardProps {
  user: UserProfile;
  logs: MealLog[];
  weightHistory: WeightLog[];
  onUpdateUser: (user: UserProfile) => void;
  onUpdateLogs: (logs: MealLog[]) => void;
  onUpdateWeight: (history: WeightLog[]) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ user, logs, weightHistory, onUpdateUser, onUpdateLogs, onUpdateWeight }) => {
  const [showLogModal, setShowLogModal] = useState(false);
  const [showGoalsModal, setShowGoalsModal] = useState(false);
  const [showWeightModal, setShowWeightModal] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false); // State for AI suggestion loading
  const [aiAdvice, setAiAdvice] = useState<string>('');

  // Chart Range State
  const [calorieRange, setCalorieRange] = useState<number>(7);
  const [weightRange, setWeightRange] = useState<number>(30);

  // Goals Edit State
  const [editGoals, setEditGoals] = useState({
    calories: user.targetCalories,
    protein: user.targetProtein,
    carbs: user.targetCarbs,
    fat: user.targetFat
  });

  // New Log State
  const [newLog, setNewLog] = useState<Partial<MealLog>>({
    date: new Date().toISOString().split('T')[0],
    time: new Date().toTimeString().substring(0, 5),
    type: MealType.LUNCH,
    description: '',
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0
  });

  // New Weight Log State
  const [newWeightLog, setNewWeightLog] = useState({
    date: new Date().toISOString().split('T')[0],
    weight: user.weight
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Stats Calculation
  const today = new Date().toISOString().split('T')[0];
  const todayLogs = logs.filter(l => l.date === today);

  const totalCalories = todayLogs.reduce((acc, curr) => acc + curr.calories, 0);
  const totalProtein = todayLogs.reduce((acc, curr) => acc + curr.protein, 0);
  const totalCarbs = todayLogs.reduce((acc, curr) => acc + curr.carbs, 0);
  const totalFat = todayLogs.reduce((acc, curr) => acc + curr.fat, 0);

  useEffect(() => {
    getDailyAdvice(user, logs).then(setAiAdvice);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logs.length]);

  const handleGetSuggestion = async () => {
    setIsSuggesting(true);
    const remaining = {
      calories: user.targetCalories - totalCalories,
      protein: user.targetProtein - totalProtein,
      carbs: user.targetCarbs - totalCarbs,
      fat: user.targetFat - totalFat
    };

    try {
      const suggestion = await getFoodSuggestion(remaining, user.goal);
      setAiAdvice(suggestion);
    } catch (e) {
      setAiAdvice("Couldn't get a suggestion right now. Try again later.");
    } finally {
      setIsSuggesting(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsAnalyzing(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = (reader.result as string).split(',')[1];
        try {
          const result = await analyzeFoodImage(base64String);
          setNewLog(prev => ({
            ...prev,
            description: result.foodName,
            calories: result.calories,
            protein: result.protein,
            carbs: result.carbs,
            fat: result.fat,
            imageUrl: reader.result as string
          }));
        } catch (err) {
          alert("Failed to analyze image. Please try again manually.");
        } finally {
          setIsAnalyzing(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (error) {
      setIsAnalyzing(false);
    }
  };

  const handleSaveLog = () => {
    if (!newLog.description) return;
    const log: MealLog = {
      id: Date.now().toString(),
      date: newLog.date!,
      time: newLog.time!,
      type: newLog.type || MealType.SNACK,
      description: newLog.description,
      calories: Number(newLog.calories),
      protein: Number(newLog.protein),
      carbs: Number(newLog.carbs),
      fat: Number(newLog.fat),
      imageUrl: newLog.imageUrl
    };
    // Update logs via prop
    const updatedLogs = [log, ...logs];
    onUpdateLogs(updatedLogs);

    setShowLogModal(false);
    setNewLog({
      date: new Date().toISOString().split('T')[0],
      time: new Date().toTimeString().substring(0, 5),
      type: MealType.LUNCH,
      description: '',
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      imageUrl: undefined
    });
  };

  const deleteLog = (id: string) => {
    const updated = logs.filter(l => l.id !== id);
    onUpdateLogs(updated);
  };

  const handleUpdateGoals = () => {
    const updatedUser = {
      ...user,
      targetCalories: Number(editGoals.calories),
      targetProtein: Number(editGoals.protein),
      targetCarbs: Number(editGoals.carbs),
      targetFat: Number(editGoals.fat),
    };
    onUpdateUser(updatedUser);
    setShowGoalsModal(false);
  };

  const handleSaveWeight = () => {
    const weightVal = Number(newWeightLog.weight);
    if (!weightVal || weightVal <= 0) return;

    // 1. Update Weight History
    // Check if entry exists for this date, if so update it, else add new
    const existingIndex = weightHistory.findIndex(w => w.date === newWeightLog.date);
    let updatedHistory = [...weightHistory];

    if (existingIndex >= 0) {
      updatedHistory[existingIndex] = { date: newWeightLog.date, weight: weightVal };
    } else {
      updatedHistory.push({ date: newWeightLog.date, weight: weightVal });
    }

    // Sort by date
    updatedHistory.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    onUpdateWeight(updatedHistory);

    // 2. Update User Profile Current Weight if date is today or later
    const isLatest = new Date(newWeightLog.date).getTime() >= new Date().setHours(0, 0, 0, 0);
    if (isLatest || updatedHistory[updatedHistory.length - 1].date === newWeightLog.date) {
      onUpdateUser({ ...user, weight: weightVal });
    }

    setShowWeightModal(false);
  };

  // Group logs by date for the summary table
  const logsByDate = logs.reduce((acc, log) => {
    if (!acc[log.date]) acc[log.date] = [];
    acc[log.date].push(log);
    return acc;
  }, {} as Record<string, MealLog[]>);

  const sortedDates = Object.keys(logsByDate).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

  // Data Filtering Helper
  const filterDataByDays = (days: number) => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString().split('T')[0];
    return cutoffStr;
  };

  // Prepare Calorie Chart Data
  const calorieChartData = Object.entries(logsByDate)
    .filter(([date]) => date >= filterDataByDays(calorieRange))
    .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
    .map(([date, dayLogs]) => ({
      date: date.slice(5), // MM-DD
      cals: dayLogs.reduce((a, c) => a + c.calories, 0)
    }));

  // Prepare Weight Chart Data
  const weightChartData = weightHistory
    .filter(w => w.date >= filterDataByDays(weightRange))
    .map(w => ({
      date: w.date.slice(5),
      weight: w.weight
    }));

  const inputClass = "w-full border border-gray-300 rounded p-2 text-sm bg-white text-gray-900 focus:ring-primary focus:border-primary";

  return (
    <div className="space-y-8">
      {/* Top Stats Cards */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-gray-800">Daily Summary</h2>
        <button onClick={() => setShowGoalsModal(true)} className="text-sm text-primary hover:text-emerald-700 font-medium flex items-center">
          <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
          Edit Goals
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-100 rounded-bl-full -mr-4 -mt-4 opacity-50 group-hover:scale-110 transition-transform"></div>
          <h3 className="text-gray-500 text-sm font-medium uppercase relative z-10">Calories Today</h3>
          <div className="flex items-end mt-2 relative z-10">
            <span className={`text-3xl font-bold ${totalCalories > user.targetCalories ? 'text-red-500' : 'text-gray-900'}`}>
              {totalCalories}
            </span>
            <span className="text-gray-400 text-sm ml-2 mb-1">/ {user.targetCalories}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5 mt-4 relative z-10">
            <div className="bg-primary h-2.5 rounded-full" style={{ width: `${Math.min((totalCalories / user.targetCalories) * 100, 100)}%` }}></div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-100 rounded-bl-full -mr-4 -mt-4 opacity-50 group-hover:scale-110 transition-transform"></div>
          <h3 className="text-gray-500 text-sm font-medium uppercase relative z-10">Protein</h3>
          <div className="flex items-end mt-2 relative z-10">
            <span className="text-3xl font-bold text-gray-900">{totalProtein}g</span>
            <span className="text-gray-400 text-sm ml-2 mb-1">/ {user.targetProtein}g</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 mt-4 relative z-10">
            <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${Math.min((totalProtein / user.targetProtein) * 100, 100)}%` }}></div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-orange-100 rounded-bl-full -mr-4 -mt-4 opacity-50 group-hover:scale-110 transition-transform"></div>
          <h3 className="text-gray-500 text-sm font-medium uppercase relative z-10">Carbs</h3>
          <div className="flex items-end mt-2 relative z-10">
            <span className="text-3xl font-bold text-gray-900">{totalCarbs}g</span>
            <span className="text-gray-400 text-sm ml-2 mb-1">/ {user.targetCarbs}g</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 mt-4 relative z-10">
            <div className="bg-orange-500 h-2 rounded-full" style={{ width: `${Math.min((totalCarbs / user.targetCarbs) * 100, 100)}%` }}></div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-purple-100 rounded-bl-full -mr-4 -mt-4 opacity-50 group-hover:scale-110 transition-transform"></div>
          <h3 className="text-gray-500 text-sm font-medium uppercase relative z-10">Fat</h3>
          <div className="flex items-end mt-2 relative z-10">
            <span className="text-3xl font-bold text-gray-900">{totalFat}g</span>
            <span className="text-gray-400 text-sm ml-2 mb-1">/ {user.targetFat}g</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 mt-4 relative z-10">
            <div className="bg-purple-500 h-2 rounded-full" style={{ width: `${Math.min((totalFat / user.targetFat) * 100, 100)}%` }}></div>
          </div>
        </div>
      </div>

      {/* AI Advice Banner */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 p-6 rounded-xl flex flex-col sm:flex-row items-start sm:items-center gap-4 shadow-sm">
        <div className="flex-shrink-0 bg-white p-3 rounded-full shadow-sm text-2xl">
          🤖
        </div>
        <div className="flex-grow">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-bold text-blue-900">AI Nutritionist Insights</h4>
            <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold">Beta</span>
          </div>
          <p className="text-blue-800 text-sm leading-relaxed">{aiAdvice || "Analyzing your patterns..."}</p>
        </div>
        <div className="flex-shrink-0 mt-2 sm:mt-0">
          <button
            onClick={handleGetSuggestion}
            disabled={isSuggesting}
            className="group relative flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-full text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-md hover:shadow-lg transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-75 disabled:cursor-not-allowed"
          >
            {isSuggesting ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Thinking...
              </>
            ) : (
              <>
                <span className="mr-2">🍎</span>
                What should I eat?
              </>
            )}
          </button>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Calorie History Chart */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-gray-900 flex items-center gap-2">
              <span className="w-2 h-6 bg-emerald-500 rounded-full"></span>
              Calorie Intake
            </h3>
            <select
              value={calorieRange}
              onChange={(e) => setCalorieRange(Number(e.target.value))}
              className="text-xs border-gray-200 rounded-lg border p-1.5 bg-gray-50 text-gray-700 focus:ring-emerald-500 focus:border-emerald-500"
            >
              <option value={7}>Last 7 Days</option>
              <option value={30}>Last 30 Days</option>
              <option value={90}>Last 3 Months</option>
            </select>
          </div>
          <div className="h-64">
            {calorieChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={calorieChartData} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis dataKey="date" fontSize={11} tickMargin={8} axisLine={false} tickLine={false} tick={{ fill: '#9ca3af' }} />
                  <YAxis fontSize={11} axisLine={false} tickLine={false} tick={{ fill: '#9ca3af' }} />
                  <RechartsTooltip
                    cursor={{ fill: '#f9fafb' }}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', padding: '12px' }}
                  />
                  <Bar dataKey="cals" fill="url(#colorCals)" radius={[6, 6, 0, 0]} name="Calories" barSize={32} />
                  <defs>
                    <linearGradient id="colorCals" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.4} />
                    </linearGradient>
                  </defs>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400 text-sm">No data for selected range</div>
            )}
          </div>
        </div>

        {/* Weight Trend Chart */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-gray-900 flex items-center gap-2">
              <span className="w-2 h-6 bg-blue-500 rounded-full"></span>
              Weight Trend
            </h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowWeightModal(true)}
                className="text-xs bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition font-medium"
              >
                + Log Weight
              </button>
              <select
                value={weightRange}
                onChange={(e) => setWeightRange(Number(e.target.value))}
                className="text-xs border-gray-200 rounded-lg border p-1.5 bg-gray-50 text-gray-700 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value={7}>Last 7 Days</option>
                <option value={30}>Last 30 Days</option>
                <option value={90}>Last 3 Months</option>
              </select>
            </div>
          </div>
          <div className="h-64">
            {weightChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={weightChartData} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis dataKey="date" fontSize={11} tickMargin={8} axisLine={false} tickLine={false} tick={{ fill: '#9ca3af' }} />
                  <YAxis domain={['auto', 'auto']} fontSize={11} axisLine={false} tickLine={false} tick={{ fill: '#9ca3af' }} />
                  <RechartsTooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', padding: '12px' }} />
                  <Line type="monotone" dataKey="weight" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} name="Weight (kg)" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                {weightHistory.length === 0 ? "No weight history yet" : "No data for selected range"}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Action Button */}
      <div className="fixed bottom-8 right-8 z-20">
        <button
          onClick={() => setShowLogModal(true)}
          className="bg-primary hover:bg-emerald-600 text-white rounded-full p-4 shadow-xl shadow-emerald-200 flex items-center justify-center transition-all transform hover:scale-105 hover:-translate-y-1 active:scale-95"
        >
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
        </button>
      </div>

      {/* Daily Logs List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <h3 className="font-bold text-xl text-gray-900">Daily Journal</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Meal</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Food Item</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Calories</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">P (g)</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">C (g)</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">F (g)</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedDates.map(date => {
                const dayLogs = logsByDate[date].sort((a, b) => a.time.localeCompare(b.time));
                const dayTotalCals = dayLogs.reduce((a, c) => a + c.calories, 0);
                const dayTotalP = dayLogs.reduce((a, c) => a + c.protein, 0);
                const dayTotalC = dayLogs.reduce((a, c) => a + c.carbs, 0);
                const dayTotalF = dayLogs.reduce((a, c) => a + c.fat, 0);

                return (
                  <React.Fragment key={date}>
                    {dayLogs.map((log, idx) => (
                      <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{idx === 0 ? date : ''}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-gray-100 text-gray-700">
                            {log.type === MealType.BREAKFAST && '🍳'}
                            {log.type === MealType.LUNCH && '🍱'}
                            {log.type === MealType.DINNER && '🍽️'}
                            {log.type === MealType.SNACK && '🥜'}
                            <span className="ml-1">{log.type}</span>
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-700 max-w-xs truncate" title={log.description}>{log.description}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium text-right">{log.calories}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">{log.protein}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">{log.carbs}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">{log.fat}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button onClick={() => deleteLog(log.id)} className="text-gray-400 hover:text-red-600 transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-gray-50 font-bold border-t-2 border-gray-100">
                      <td colSpan={3} className="px-6 py-3 text-right text-xs uppercase text-gray-500 tracking-wider">Daily Total</td>
                      <td className="px-6 py-3 text-right text-sm text-gray-900">{dayTotalCals}</td>
                      <td className="px-6 py-3 text-right text-sm text-gray-900">{dayTotalP}</td>
                      <td className="px-6 py-3 text-right text-sm text-gray-900">{dayTotalC}</td>
                      <td className="px-6 py-3 text-right text-sm text-gray-900">{dayTotalF}</td>
                      <td></td>
                    </tr>
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Goals Modal */}
      {showGoalsModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-900 bg-opacity-50 transition-opacity backdrop-blur-sm" onClick={() => setShowGoalsModal(false)}></div>
            <div className="inline-block align-bottom bg-white rounded-2xl text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-md w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <h3 className="text-lg leading-6 font-bold text-gray-900 mb-4">Adjust Nutrition Goals</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Daily Calories (kcal)</label>
                    <input type="number" className={inputClass} value={editGoals.calories} onChange={e => setEditGoals({ ...editGoals, calories: Number(e.target.value) })} />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Protein (g)</label>
                      <input type="number" className={inputClass} value={editGoals.protein} onChange={e => setEditGoals({ ...editGoals, protein: Number(e.target.value) })} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Carbs (g)</label>
                      <input type="number" className={inputClass} value={editGoals.carbs} onChange={e => setEditGoals({ ...editGoals, carbs: Number(e.target.value) })} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Fat (g)</label>
                      <input type="number" className={inputClass} value={editGoals.fat} onChange={e => setEditGoals({ ...editGoals, fat: Number(e.target.value) })} />
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button type="button" onClick={handleUpdateGoals} className="w-full inline-flex justify-center rounded-lg border border-transparent shadow-sm px-4 py-2 bg-primary text-base font-medium text-white hover:bg-emerald-600 focus:outline-none sm:ml-3 sm:w-auto sm:text-sm">
                  Update Goals
                </button>
                <button type="button" onClick={() => setShowGoalsModal(false)} className="mt-3 w-full inline-flex justify-center rounded-lg border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Update Weight Modal */}
      {showWeightModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-900 bg-opacity-50 transition-opacity backdrop-blur-sm" onClick={() => setShowWeightModal(false)}></div>
            <div className="inline-block align-bottom bg-white rounded-2xl text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-sm w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <h3 className="text-lg leading-6 font-bold text-gray-900 mb-4">Log Current Weight</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                    <input type="date" className={inputClass} value={newWeightLog.date} onChange={e => setNewWeightLog({ ...newWeightLog, date: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Weight (kg)</label>
                    <input type="number" step="0.1" className={inputClass} value={newWeightLog.weight} onChange={e => setNewWeightLog({ ...newWeightLog, weight: Number(e.target.value) })} />
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button type="button" onClick={handleSaveWeight} className="w-full inline-flex justify-center rounded-lg border border-transparent shadow-sm px-4 py-2 bg-primary text-base font-medium text-white hover:bg-emerald-600 focus:outline-none sm:ml-3 sm:w-auto sm:text-sm">
                  Save Weight
                </button>
                <button type="button" onClick={() => setShowWeightModal(false)} className="mt-3 w-full inline-flex justify-center rounded-lg border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Log Modal */}
      {showLogModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-900 bg-opacity-50 transition-opacity backdrop-blur-sm" onClick={() => setShowLogModal(false)}></div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            <div className="inline-block align-bottom bg-white rounded-2xl text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg leading-6 font-bold text-gray-900" id="modal-title">Log Meal</h3>
                  <button onClick={() => setShowLogModal(false)} className="text-gray-400 hover:text-gray-600">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>

                {/* Image Upload */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">1. Analyze Photo (AI)</label>
                  <div className="flex items-center justify-center w-full">
                    <label className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl cursor-pointer hover:bg-gray-50 transition-colors ${isAnalyzing ? 'bg-gray-100 border-gray-400' : 'border-gray-300'}`}>
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        {isAnalyzing ? (
                          <div className="flex flex-col items-center">
                            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mb-2"></div>
                            <p className="text-sm text-gray-500">Analyzing food...</p>
                          </div>
                        ) : (
                          <>
                            <svg className="w-8 h-8 mb-3 text-gray-400" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 16"><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2" /></svg>
                            <p className="text-xs text-gray-500 font-medium">Click to upload food photo</p>
                          </>
                        )}
                      </div>
                      <input ref={fileInputRef} type="file" className="hidden" accept="image/*" onChange={handleImageUpload} disabled={isAnalyzing} />
                    </label>
                  </div>
                </div>

                {/* Manual Entry Form */}
                <div className="space-y-4">
                  <p className="text-sm font-medium text-gray-700">2. Review & Edit Details</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Date</label>
                      <input type="date" className={inputClass} value={newLog.date} onChange={e => setNewLog({ ...newLog, date: e.target.value })} />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Type</label>
                      <select className={inputClass} value={newLog.type} onChange={e => setNewLog({ ...newLog, type: e.target.value as MealType })}>
                        {Object.values(MealType).map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Description</label>
                    <input type="text" placeholder="e.g. Chicken Rice" className={inputClass} value={newLog.description} onChange={e => setNewLog({ ...newLog, description: e.target.value })} />
                  </div>

                  <div className="grid grid-cols-4 gap-2">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Cals</label>
                      <input type="number" className={inputClass} value={newLog.calories} onChange={e => setNewLog({ ...newLog, calories: Number(e.target.value) })} />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Pro</label>
                      <input type="number" className={inputClass} value={newLog.protein} onChange={e => setNewLog({ ...newLog, protein: Number(e.target.value) })} />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Carb</label>
                      <input type="number" className={inputClass} value={newLog.carbs} onChange={e => setNewLog({ ...newLog, carbs: Number(e.target.value) })} />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Fat</label>
                      <input type="number" className={inputClass} value={newLog.fat} onChange={e => setNewLog({ ...newLog, fat: Number(e.target.value) })} />
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button type="button" onClick={handleSaveLog} className="w-full inline-flex justify-center rounded-lg border border-transparent shadow-sm px-4 py-2 bg-primary text-base font-medium text-white hover:bg-emerald-600 focus:outline-none sm:ml-3 sm:w-auto sm:text-sm">
                  Save Meal
                </button>
                <button type="button" onClick={() => setShowLogModal(false)} className="mt-3 w-full inline-flex justify-center rounded-lg border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
