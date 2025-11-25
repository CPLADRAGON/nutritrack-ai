import React, { useState, useRef, useEffect } from 'react';
import { UserProfile, MealLog, WeightLog, MealType } from '../types';
import { analyzeFoodImage, getDailyAdvice } from '../services/geminiService';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';

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
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiAdvice, setAiAdvice] = useState<string>('');
  
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

  // Group logs by date for the summary table
  const logsByDate = logs.reduce((acc, log) => {
    if (!acc[log.date]) acc[log.date] = [];
    acc[log.date].push(log);
    return acc;
  }, {} as Record<string, MealLog[]>);

  const sortedDates = Object.keys(logsByDate).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
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
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-gray-500 text-sm font-medium uppercase">Calories Today</h3>
          <div className="flex items-end mt-2">
            <span className={`text-3xl font-bold ${totalCalories > user.targetCalories ? 'text-red-500' : 'text-gray-900'}`}>
              {totalCalories}
            </span>
            <span className="text-gray-400 text-sm ml-2 mb-1">/ {user.targetCalories}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5 mt-4">
            <div className="bg-primary h-2.5 rounded-full" style={{ width: `${Math.min((totalCalories / user.targetCalories) * 100, 100)}%` }}></div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-gray-500 text-sm font-medium uppercase">Protein</h3>
             <div className="flex items-end mt-2">
            <span className="text-3xl font-bold text-gray-900">{totalProtein}g</span>
            <span className="text-gray-400 text-sm ml-2 mb-1">/ {user.targetProtein}g</span>
          </div>
        </div>
        
         <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-gray-500 text-sm font-medium uppercase">Carbs</h3>
             <div className="flex items-end mt-2">
            <span className="text-3xl font-bold text-gray-900">{totalCarbs}g</span>
            <span className="text-gray-400 text-sm ml-2 mb-1">/ {user.targetCarbs}g</span>
          </div>
        </div>

         <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-gray-500 text-sm font-medium uppercase">Fat</h3>
             <div className="flex items-end mt-2">
            <span className="text-3xl font-bold text-gray-900">{totalFat}g</span>
            <span className="text-gray-400 text-sm ml-2 mb-1">/ {user.targetFat}g</span>
          </div>
        </div>
      </div>

      {/* AI Advice Banner */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 p-4 rounded-xl flex items-start gap-3">
        <span className="text-2xl">🤖</span>
        <div>
           <h4 className="font-semibold text-blue-900">AI Nutritionist Insights</h4>
           <p className="text-blue-800 text-sm mt-1">{aiAdvice || "Analyzing your patterns..."}</p>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="font-bold text-gray-900 mb-4">Calorie Intake History</h3>
          <div className="h-64">
             <ResponsiveContainer width="100%" height="100%">
                <BarChart data={[...sortedDates].reverse().slice(-7).map(date => {
                    const dLogs = logsByDate[date];
                    return {
                        date: date.slice(5),
                        cals: dLogs.reduce((a, c) => a + c.calories, 0)
                    };
                })}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <RechartsTooltip />
                  <Bar dataKey="cals" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
             </ResponsiveContainer>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
             <h3 className="font-bold text-gray-900 mb-4">Weight Trend</h3>
             <div className="h-64 flex items-center justify-center text-gray-400 bg-gray-50 rounded-lg">
                <span className="text-sm">Weight tracking graph coming soon</span>
             </div>
        </div>
      </div>

      {/* Main Action Button */}
      <div className="fixed bottom-8 right-8 z-20">
        <button 
          onClick={() => setShowLogModal(true)}
          className="bg-primary hover:bg-emerald-600 text-white rounded-full p-4 shadow-lg flex items-center justify-center transition-all transform hover:scale-105"
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Meal</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Food Item</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Calories</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">P (g)</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">C (g)</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">F (g)</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedDates.map(date => {
                 const dayLogs = logsByDate[date].sort((a,b) => a.time.localeCompare(b.time));
                 const dayTotalCals = dayLogs.reduce((a,c) => a+c.calories, 0);
                 const dayTotalP = dayLogs.reduce((a,c) => a+c.protein, 0);
                 const dayTotalC = dayLogs.reduce((a,c) => a+c.carbs, 0);
                 const dayTotalF = dayLogs.reduce((a,c) => a+c.fat, 0);

                 return (
                    <React.Fragment key={date}>
                       {dayLogs.map((log, idx) => (
                           <tr key={log.id} className="hover:bg-gray-50">
                               <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{idx === 0 ? date : ''}</td>
                               <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                 <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                    {log.type}
                                 </span>
                               </td>
                               <td className="px-6 py-4 text-sm text-gray-700 max-w-xs truncate" title={log.description}>{log.description}</td>
                               <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">{log.calories}</td>
                               <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">{log.protein}</td>
                               <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">{log.carbs}</td>
                               <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">{log.fat}</td>
                               <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                 <button onClick={() => deleteLog(log.id)} className="text-red-600 hover:text-red-900">Delete</button>
                               </td>
                           </tr>
                       ))}
                       <tr className="bg-gray-50 font-bold">
                           <td colSpan={3} className="px-6 py-3 text-right text-xs uppercase text-gray-500">Daily Summary</td>
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
                <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setShowGoalsModal(false)}></div>
                <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-md w-full">
                    <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                        <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Adjust Nutrition Goals</h3>
                         <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Daily Calories (kcal)</label>
                                <input type="number" className={inputClass} value={editGoals.calories} onChange={e => setEditGoals({...editGoals, calories: Number(e.target.value)})} />
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Protein (g)</label>
                                    <input type="number" className={inputClass} value={editGoals.protein} onChange={e => setEditGoals({...editGoals, protein: Number(e.target.value)})} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Carbs (g)</label>
                                    <input type="number" className={inputClass} value={editGoals.carbs} onChange={e => setEditGoals({...editGoals, carbs: Number(e.target.value)})} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Fat (g)</label>
                                    <input type="number" className={inputClass} value={editGoals.fat} onChange={e => setEditGoals({...editGoals, fat: Number(e.target.value)})} />
                                </div>
                            </div>
                        </div>
                    </div>
                     <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                        <button type="button" onClick={handleUpdateGoals} className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-primary text-base font-medium text-white hover:bg-emerald-600 focus:outline-none sm:ml-3 sm:w-auto sm:text-sm">
                            Update Goals
                        </button>
                        <button type="button" onClick={() => setShowGoalsModal(false)} className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm">
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
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setShowLogModal(false)}></div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg w-full">
               <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4" id="modal-title">Log Meal</h3>
                  
                  {/* Image Upload */}
                  <div className="mb-6">
                      <label className="block text-sm font-medium text-gray-700 mb-2">1. Analyze Photo (AI)</label>
                      <div className="flex items-center justify-center w-full">
                          <label className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-gray-50 ${isAnalyzing ? 'bg-gray-100 border-gray-400' : 'border-gray-300'}`}>
                              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                  {isAnalyzing ? (
                                      <p className="text-sm text-gray-500 animate-pulse">Analyzing food...</p>
                                  ) : (
                                    <>
                                        <svg className="w-8 h-8 mb-4 text-gray-500" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 16"><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2"/></svg>
                                        <p className="text-xs text-gray-500">Click to upload food photo</p>
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
                         <input type="date" className={inputClass} value={newLog.date} onChange={e => setNewLog({...newLog, date: e.target.value})} />
                         <select className={inputClass} value={newLog.type} onChange={e => setNewLog({...newLog, type: e.target.value as MealType})}>
                            {Object.values(MealType).map(t => <option key={t} value={t}>{t}</option>)}
                         </select>
                    </div>
                    <input type="text" placeholder="Food description" className={inputClass} value={newLog.description} onChange={e => setNewLog({...newLog, description: e.target.value})} />
                    
                    <div className="grid grid-cols-4 gap-2">
                        <div>
                            <label className="text-xs text-gray-500">Calories</label>
                            <input type="number" className={inputClass} value={newLog.calories} onChange={e => setNewLog({...newLog, calories: Number(e.target.value)})} />
                        </div>
                        <div>
                            <label className="text-xs text-gray-500">Protein</label>
                            <input type="number" className={inputClass} value={newLog.protein} onChange={e => setNewLog({...newLog, protein: Number(e.target.value)})} />
                        </div>
                        <div>
                            <label className="text-xs text-gray-500">Carbs</label>
                            <input type="number" className={inputClass} value={newLog.carbs} onChange={e => setNewLog({...newLog, carbs: Number(e.target.value)})} />
                        </div>
                        <div>
                            <label className="text-xs text-gray-500">Fat</label>
                            <input type="number" className={inputClass} value={newLog.fat} onChange={e => setNewLog({...newLog, fat: Number(e.target.value)})} />
                        </div>
                    </div>
                  </div>
               </div>
               <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                  <button type="button" onClick={handleSaveLog} className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-primary text-base font-medium text-white hover:bg-emerald-600 focus:outline-none sm:ml-3 sm:w-auto sm:text-sm">
                    Save Meal
                  </button>
                  <button type="button" onClick={() => setShowLogModal(false)} className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm">
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