import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { ApiError, api } from '../api';
import type { User } from '../api';
type AuthState={user:User|null;loading:boolean;login:(username:string,password:string)=>Promise<void>;logout:()=>void};
const C=createContext<AuthState|null>(null);
export const AuthProvider=({children}:{children:React.ReactNode})=>{const [user,setUser]=useState<User|null>(null);const [loading,setLoading]=useState(true);useEffect(()=>{if(!localStorage.getItem('kb_token')){setLoading(false);return;}api.memberMe().then(setUser).catch(e=>{if(e instanceof ApiError&&e.status===401)localStorage.removeItem('kb_token');}).finally(()=>setLoading(false));},[]);const value=useMemo<AuthState>(()=>({user,loading,login:async(username,password)=>{const r=await api.memberLogin(username,password);localStorage.setItem('kb_token',r.token);setUser(r.user);},logout:()=>{localStorage.removeItem('kb_token');setUser(null);}}),[user,loading]);return <C.Provider value={value}>{children}</C.Provider>;};
export const useAuth=()=>{const v=useContext(C);if(!v)throw new Error('AuthProvider required');return v;};
