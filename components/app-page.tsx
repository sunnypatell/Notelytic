'use client'

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Moon, Search, Plus, BarChart, Calendar, Clock, Tag, Trash2, Edit3, Pin, Archive, Download, Upload, ZoomIn, ZoomOut, Github, Linkedin, Globe } from 'lucide-react'
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { toast, ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import dynamic from 'next/dynamic'
import 'react-quill/dist/quill.snow.css'
import ReactMarkdown from 'react-markdown'
import type { Theme } from 'emoji-picker-react'

const ReactQuill = dynamic(() => import('react-quill'), { ssr: false })
const EmojiPicker = dynamic(() => import('emoji-picker-react'), { ssr: false })

type Note = {
  id: string
  title: string
  content: string
  category: string
  color: string
  createdAt: Date
  updatedAt: Date
  image?: string
  isPinned: boolean
  isArchived: boolean
  tags: string[]
}

type NewNote = Omit<Note, 'id' | 'createdAt' | 'updatedAt' | 'isPinned' | 'isArchived'>

type Category = {
  name: string
  color: string
}

const initialCategories: Category[] = [
  { name: 'Work 💼', color: '#FF5733' },
  { name: 'Personal 🏠', color: '#33FF57' },
  { name: 'Ideas 💡', color: '#3357FF' },
  { name: 'To-Do ✅', color: '#FF33F5' },
]

const MotionCard = motion(Card)

const modules = {
  toolbar: [
    [{ 'header': '1'}, {'header': '2'}, { 'font': [] }],
    [{size: []}],
    ['bold', 'italic', 'underline', 'strike', 'blockquote'],
    [{'list': 'ordered'}, {'list': 'bullet'}, 
     {'indent': '-1'}, {'indent': '+1'}],
    ['link', 'image'],
    ['clean']
  ],
}

const formats = [
  'header', 'font', 'size',
  'bold', 'italic', 'underline', 'strike', 'blockquote',
  'list', 'bullet', 'indent',
  'link', 'image'
]

// IndexedDB setup
const dbName = 'NotelyticsDB'
const dbVersion = 1
let db: IDBDatabase | null = null

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, dbVersion)

    request.onerror = (event) => {
      console.error('IndexedDB error:', event)
      reject('Error opening database')
    }

    request.onsuccess = (event) => {
      db = (event.target as IDBOpenDBRequest).result
      resolve(db)
    }

    request.onupgradeneeded = (event) => {
      db = (event.target as IDBOpenDBRequest).result
      db.createObjectStore('notes', { keyPath: 'id' })
      db.createObjectStore('categories', { keyPath: 'name' })
    }
  })
}

const saveToIndexedDB = async (storeName: string, data: Note | Category) => {
  if (!db) await openDB()
  return new Promise((resolve, reject) => {
    const transaction = db!.transaction(storeName, 'readwrite')
    const store = transaction.objectStore(storeName)
    const request = store.put(data)

    request.onerror = () => reject('Error saving data')
    request.onsuccess = () => resolve(null)
  })
}

const getAllFromIndexedDB = async (storeName: string): Promise<(Note | Category)[]> => {
  if (!db) await openDB()
  return new Promise((resolve, reject) => {
    const transaction = db!.transaction(storeName, 'readonly')
    const store = transaction.objectStore(storeName)
    const request = store.getAll()

    request.onerror = () => reject('Error getting data')
    request.onsuccess = () => resolve(request.result)
  })
}

const deleteFromIndexedDB = async (storeName: string, key: string) => {
  if (!db) await openDB()
  return new Promise((resolve, reject) => {
    const transaction = db!.transaction(storeName, 'readwrite')
    const store = transaction.objectStore(storeName)
    const request = store.delete(key)

    request.onerror = () => reject('Error deleting data')
    request.onsuccess = () => resolve(null)
  })
}

export default function NotelyticsNoteDashboard() {
  const [notes, setNotes] = useState<Note[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [newNote, setNewNote] = useState<NewNote>({ title: '', content: '', category: '', color: '', image: '', tags: [] })
  const [editingNote, setEditingNote] = useState<Note | null>(null)
  const [previewNote, setPreviewNote] = useState<Note | null>(null)
  const [isAddingNote, setIsAddingNote] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [sortBy, setSortBy] = useState<'updatedAt' | 'createdAt' | 'title'>('updatedAt')
  const [currentTime, setCurrentTime] = useState(new Date())
  const [categories, setCategories] = useState<Category[]>(initialCategories)
  const [newCategory, setNewCategory] = useState<Category>({ name: '', color: '#000000' })
  const [showArchived, setShowArchived] = useState(false)
  const [isMarkdownMode, setIsMarkdownMode] = useState(false)
  const [allTags, setAllTags] = useState<string[]>([])
  const [isZoomed, setIsZoomed] = useState(false)
  const [showTosDialog, setShowTosDialog] = useState(false)
  const [joke, setJoke] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const initializeData = async () => {
      await openDB()
      const savedNotes = await getAllFromIndexedDB('notes')
      const savedCategories = await getAllFromIndexedDB('categories')

      if (savedNotes.length > 0) {
        setNotes(savedNotes.map((note) => ({
          ...note,
          createdAt: new Date(note.createdAt),
          updatedAt: new Date(note.updatedAt)
        })) as Note[])
      } else {
        // If no saved notes, create welcome notes
        const welcomeNotes: Note[] = [
          {
            id: '1',
            title: 'Welcome to Notelytic 📝',
            content: 'This is your new note-taking dashboard! 🎉',
            category: 'Personal 🏠',
            color: '#33FF57',
            createdAt: new Date(),
            updatedAt: new Date(),
            isPinned: false,
            isArchived: false,
            tags: ['welcome']
          },
          {
            id: '2',
            title: 'Getting Started 🚀',
            content: 'Click the + button to add a new note.',
            category: 'To-Do ✅',
            color: '#FF33F5',
            createdAt: new Date(),
            updatedAt: new Date(),
            isPinned: false,
            isArchived: false,
            tags: ['tutorial']
          },
          {
            id: '3',
            title: 'Features ✨',
            content: 'Notelytic supports rich text editing, image uploads, and more!',
            category: 'Ideas 💡',
            color: '#3357FF',
            createdAt: new Date(),
            updatedAt: new Date(),
            isPinned: false,
            isArchived: false,
            tags: ['features']
          }
        ]
        setNotes(welcomeNotes)
        welcomeNotes.forEach(note => saveToIndexedDB('notes', note))
      }

      if (savedCategories.length > 0) {
        setCategories(savedCategories as Category[])
      } else {
        initialCategories.forEach(category => saveToIndexedDB('categories', category))
      }
    }

    initializeData()
  }, [])

  useEffect(() => {
    // Update allTags whenever notes change
    const tags = new Set<string>()
    notes.forEach(note => note.tags.forEach(tag => tags.add(tag)))
    setAllTags(Array.from(tags))
  }, [notes])

  useEffect(() => {
    // Apply dark mode to body
    document.body.classList.add('dark')

    // Apply dark mode styles to ReactQuill
    const style = document.createElement('style')
    style.textContent = `
      .ql-toolbar.ql-snow {
        border-color: #4a5568;
        background-color: #2d3748;
        z-index: 30;
        position: relative;
      }
      .ql-container.ql-snow {
        border-color: #4a5568;
        height: 200px;
        margin-bottom: 1rem;
      }
      .ql-editor {
        background-color: #1a202c;
        color: #e2e8f0;
        min-height: 200px;
        font-size: 1rem;
      }
      .ql-formats button {
        color: #e2e8f0 !important;
      }
      .ql-formats button.ql-active,
      .ql-formats button:hover {
        color: #90cdf4 !important;
      }
      .ql-formats .ql-stroke {
        stroke: #e2e8f0;
      }
      .ql-formats .ql-fill {
        fill: #e2e8f0;
      }
      .ql-formats button:hover .ql-stroke,
      .ql-formats button.ql-active .ql-stroke {
        stroke: #90cdf4;
      }
      .ql-formats button:hover .ql-fill,
      .ql-formats button.ql-active .ql-fill {
        fill: #90cdf4;
      }
      .ql-picker-label {
        color: #e2e8f0 !important;
      }
      .ql-picker-options {
        background-color: #2d3748 !important;
        z-index: 31 !important;
      }
      .ql-picker-item {
        color: #e2e8f0 !important;
      }
      .ql-picker-item:hover {
        color: #90cdf4 !important;
      }
      .ql-tooltip {
        background-color: #2d3748 !important;
        color: #e2e8f0 !important;
        border-color: #4a5568 !important;
        z-index: 31 !important;
      }
      .ql-tooltip input[type="text"] {
        background-color: #1a202c !important;
        color: #e2e8f0 !important;
        border-color: #4a5568 !important;
      }
      .ql-tooltip a.ql-action,
      .ql-tooltip a.ql-remove {
        color: #90cdf4 !important;
      }
    `
    document.head.appendChild(style)

    return () => {
      document.head.removeChild(style)
    }
  }, [])

  useEffect(() => {
    const updateTime = () => {
      setCurrentTime(new Date())
    }
    
    updateTime() // Initial update
    const timer = setInterval(updateTime, 1000)
    
    return () => clearInterval(timer)
  }, [])

  const filteredNotes = useMemo(() => {
    return notes
      .filter(note => 
        (selectedCategory === 'All' || note.category === selectedCategory) &&
        (note.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
         note.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
         note.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))) &&
        (showArchived ? note.isArchived : !note.isArchived)
      )
      .sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1
        if (!a.isPinned && b.isPinned) return 1
        if (sortBy === 'title') {
          return a.title.localeCompare(b.title)
        }
        return b[sortBy].getTime() - a[sortBy].getTime()
      })
  }, [notes, selectedCategory, searchTerm, showArchived, sortBy])

  const addNote = useCallback(async () => {
    if (newNote.title && newNote.content && newNote.category) {
      const color = categories.find(cat => cat.name === newNote.category)?.color || '#CCCCCC'
      const now = new Date()
      const newNoteWithId: Note = { 
        ...newNote, 
        id: Date.now().toString(), 
        color, 
        createdAt: now, 
        updatedAt: now, 
        isPinned: false,
        isArchived: false,
        tags: newNote.tags
      }
      await saveToIndexedDB('notes', newNoteWithId)
      setNotes(prevNotes => [...prevNotes, newNoteWithId])
      setNewNote({ title: '', content: '', category: '', color: '', image: '', tags: [] })
      setIsAddingNote(false)
      toast.success('Note added successfully! 🎉')
    } else {
      toast.error('Please fill in all required fields 🙏')
    }
  }, [newNote, categories])

  const updateNote = useCallback(async () => {
    if (editingNote) {
      const updatedNote = { ...editingNote, updatedAt: new Date() }
      await saveToIndexedDB('notes', updatedNote)
      setNotes(prevNotes => 
        prevNotes.map(note => 
          note.id === editingNote.id ? updatedNote : note
        )
      )
      setEditingNote(null)
      toast.success('Note updated successfully! 📝')
    }
  }, [editingNote])

  const deleteNote = useCallback(async (id: string) => {
    await deleteFromIndexedDB('notes', id)
    setNotes(prevNotes => prevNotes.filter(note => note.id !== id))
    toast.info('Note deleted 🗑️')
  }, [])

  const togglePinNote = useCallback(async (id: string) => {
    const noteToToggle = notes.find(note => note.id === id)
    if (noteToToggle) {
      const pinnedNotes = notes.filter(note => note.isPinned).length
      if (!noteToToggle.isPinned && pinnedNotes >= 3) {
        toast.error('You can only pin up to 3 notes 📌')
        return
      }
      const updatedNote = { ...noteToToggle, isPinned: !noteToToggle.isPinned }
      await saveToIndexedDB('notes', updatedNote)
      setNotes(prevNotes => prevNotes.map(note => 
        note.id === id ? updatedNote : note
      ))
      if (updatedNote.isPinned) {
        toast.success('Note pinned 📌')
      } else {
        toast.info('Note unpinned 📌❌')
      }
    }
  }, [notes])

  const toggleArchiveNote = useCallback(async (id: string) => {
    const noteToToggle = notes.find(note => note.id === id)
    if (noteToToggle) {
      const updatedNote = { ...noteToToggle, isArchived: !noteToToggle.isArchived }
      await saveToIndexedDB('notes', updatedNote)
      setNotes(prevNotes => prevNotes.map(note => 
        note.id === id ? updatedNote : note
      ))
      if (updatedNote.isArchived) {
        toast.success('Note archived 📂')
      } else {
        toast.info('Note unarchived 📂')
      }
    }
  }, [notes])

  const handleImageUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          if (editingNote) {
            setEditingNote({ ...editingNote, image: reader.result })
          } else {
            setNewNote({ ...newNote, image: reader.result })
          }
          toast.success('Image uploaded successfully! 🖼️')
        }
      }
      reader.readAsDataURL(file)
    }
  }, [editingNote, newNote])

  const addCategory = useCallback(async () => {
    if (newCategory.name && newCategory.color) {
      await saveToIndexedDB('categories', newCategory)
      setCategories(prevCategories => [...prevCategories, newCategory])
      setNewCategory({ name: '', color: '#000000' })
      toast.success('Category added successfully! 🎨')
    } else {
      toast.error('Please provide a name and color for the new category 🙏')
    }
  }, [newCategory])

  const deleteCategory = useCallback(async (categoryName: string) => {
    await deleteFromIndexedDB('categories', categoryName)
    setCategories(prevCategories => prevCategories.filter(cat => cat.name !== categoryName))
    setNotes(prevNotes => prevNotes.map(note => 
      note.category === categoryName ? { ...note, category: 'Uncategorized' } : note
    ))
    toast.success('Category deleted successfully! 🗑️')
  }, [])

  const exportNotes = useCallback(async () => {
    const notesToExport = await getAllFromIndexedDB('notes')
    const categoriesToExport = await getAllFromIndexedDB('categories')
    const dataToExport = {
      notes: notesToExport,
      categories: categoriesToExport
    }
    const dataStr = JSON.stringify(dataToExport)
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr)
    const exportFileDefaultName = 'notelytic_backup.json'

    const linkElement = document.createElement('a')
    linkElement.setAttribute('href', dataUri)
    linkElement.setAttribute('download', exportFileDefaultName)
    linkElement.click()
    toast.success('Notes and categories exported successfully! 📤')
  }, [])

  const importNotes = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = async (e) => {
        try {
          const importedData = JSON.parse(e.target?.result as string)
          if (importedData.notes && importedData.categories) {
            for (const note of importedData.notes) {
              await saveToIndexedDB('notes', {
                ...note,
                createdAt: new Date(note.createdAt),
                updatedAt: new Date(note.updatedAt)
              })
            }
            for (const category of importedData.categories) {
              await saveToIndexedDB('categories', category)
            }
            const updatedNotes = await getAllFromIndexedDB('notes')
            const updatedCategories = await getAllFromIndexedDB('categories')
            setNotes(updatedNotes.map(note => ({
              ...note,
              createdAt: new Date(note.createdAt),
              updatedAt: new Date(note.updatedAt)
            })) as Note[])
            setCategories(updatedCategories as Category[])
            toast.success('Notes and categories imported successfully! 📥')
          } else {
            throw new Error('Invalid import format')
          }
        } catch (error) {
          console.error('Import error:', error)
          toast.error('Failed to import data. Please check the file format. 😕')
        }
      }
      reader.readAsText(file)
    }
  }, [])

  const getJoke = useCallback(async () => {
    try {
      const response = await fetch('https://official-joke-api.appspot.com/random_joke')
      const data = await response.json()
      setJoke(`${data.setup} ${data.punchline}`)
      toast.info('New joke loaded! 😄')
    } catch (error) {
      console.error('Error fetching joke:', error)
      setJoke('Failed to fetch a joke. Try again later!')
      toast.error('Failed to fetch a joke. Please try again. 😕')
    }
  }, [])

  const handleTagChange = useCallback(async (tags: string[], noteId?: string) => {
    const updatedTags = tags.filter(tag => tag.trim() !== '').map(tag => tag.trim())
    if (noteId) {
      const noteToUpdate = notes.find(note => note.id === noteId)
      if (noteToUpdate) {
        const updatedNote = { ...noteToUpdate, tags: updatedTags }
        await saveToIndexedDB('notes', updatedNote)
        setNotes(prevNotes => prevNotes.map(note => 
          note.id === noteId ? updatedNote : note
        ))
        toast.success('Tags updated successfully! 🏷️')
      }
    } else {
      setNewNote(prevNote => ({ ...prevNote, tags: updatedTags }))
    }
  }, [notes])

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="max-w-7xl mx-auto p-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold">
            Notelytic 📝
          </h1>
          <div className="flex items-center space-x-4">
            <Moon className="h-6 w-6" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          <Card className="bg-gray-800 text-white">
            <CardContent className="flex items-center justify-center p-6">
              <div className="text-center">
                <BarChart className="h-8 w-8 mb-2 mx-auto text-blue-500" />
                <h2 className="text-2xl font-bold">{notes.length}</h2>
                <p className="text-sm text-gray-400">Total Notes 📊</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gray-800 text-white">
            <CardContent className="flex items-center justify-center p-6">
              <div className="text-center">
                <Calendar className="h-8 w-8 mb-2 mx-auto text-green-500" />
                <h2 className="text-2xl font-bold">
                  {currentTime.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit'
                  })}
                </h2>
                <p className="text-sm text-gray-400">Current Date 📅</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gray-800 text-white">
            <CardContent className="flex items-center justify-center p-6">
              <div className="text-center">
                <Clock className="h-8 w-8 mb-2 mx-auto text-yellow-500" />
                <h2 className="text-2xl font-bold">
                  {currentTime.toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: true
                  })}
                </h2>
                <p className="text-sm text-gray-400">Current Time ⏰</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gray-800 text-white">
            <CardContent className="flex items-center justify-center p-6">
              <div className="text-center">
                <Tag className="h-8 w-8 mb-2 mx-auto text-purple-500" />
                <h2 className="text-2xl font-bold">{categories.length}</h2>
                <p className="text-sm text-gray-400">Categories 🏷️</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
          <div className="w-full md:w-1/3 relative">
            <Input
              type="text"
              placeholder="Search notes... 🔍"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-full bg-gray-700 text-white"
            />
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          </div>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-full md:w-[180px] bg-gray-700 text-white">
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent className="bg-gray-700 text-white">
              <SelectItem value="All">All Categories 📚</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat.name} value={cat.name}>{cat.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={(value: 'updatedAt' | 'createdAt' | 'title') => setSortBy(value)}>
            <SelectTrigger className="w-full md:w-[180px] bg-gray-700 text-white">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent className="bg-gray-700 text-white">
              <SelectItem value="updatedAt">Last Updated 🕒</SelectItem>
              <SelectItem value="createdAt">Created Date 📅</SelectItem>
              <SelectItem value="title">Title 📝</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center space-x-2">
            <Switch
              id="show-archived"
              checked={showArchived}
              onCheckedChange={setShowArchived}
            />
            <Label htmlFor="show-archived" className="text-white">Show Archived 📂</Label>
          </div>
        </div>

        <Tabs defaultValue="grid" className="mb-8">
          <TabsList className="grid w-full grid-cols-2 mb-4 bg-gray-700">
            <TabsTrigger value="grid" className="data-[state=active]:bg-gray-600 text-white">Grid View 📊</TabsTrigger>
            <TabsTrigger value="list" className="data-[state=active]:bg-gray-600 text-white">List View 📋</TabsTrigger>
          </TabsList>
          <TabsContent value="grid">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <AnimatePresence>
                {filteredNotes.map((note) => (
                  <motion.div
                    key={note.id}
                    layout
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.3 }}
                  >
                    <MotionCard
                      className="relative overflow-hidden cursor-pointer bg-gray-800"
                      onClick={() => setPreviewNote(note)}
                    >
                      <CardContent className="p-6">
                        <div className="flex justify-between items-center mb-2">
                          <h2 className="text-xl font-semibold truncate">{note.title}</h2>
                          <div className="flex space-x-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation()
                                togglePinNote(note.id)
                              }}
                              className={note.isPinned ? 'text-yellow-500' : 'text-gray-400'}
                            >
                              <Pin className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation()
                                toggleArchiveNote(note.id)
                              }}
                              className={note.isArchived ? 'text-blue-500' : 'text-gray-400'}
                            >
                              <Archive className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation()
                                setEditingNote(note)
                              }}
                              className="text-blue-500 hover:text-blue-600"
                            >
                              <Edit3 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        <div className="mb-4 h-20 overflow-hidden">
                          {isMarkdownMode ? (
                            <ReactMarkdown>{note.content.substring(0, 100) + '...'}</ReactMarkdown>
                          ) : (
                            <div dangerouslySetInnerHTML={{ __html: note.content.substring(0, 100) + '...' }} />
                          )}
                        </div>
                        {note.image && (
                          <img src={note.image} alt="Note image" className="w-full h-40 object-cover mb-4 rounded" />
                        )}
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium px-2 py-1 rounded-full bg-opacity-50" style={{ backgroundColor: note.color }}>
                            {note.category}
                          </span>
                          <span className="text-sm text-gray-400">
                            {note.updatedAt.toLocaleString()}
                          </span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {note.tags.map(tag => (
                            <span key={tag} className="bg-blue-900 text-blue-300 text-xs font-medium mr-2 px-2.5 py-0.5 rounded">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </CardContent>
                    </MotionCard>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </TabsContent>
          <TabsContent value="list">
            <div className="space-y-4">
              <AnimatePresence>
                {filteredNotes.map((note) => (
                  <motion.div
                    key={note.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3 }}
                  >
                    <Card className="relative overflow-hidden cursor-pointer bg-gray-800" onClick={() => setPreviewNote(note)}>
                      <CardContent className="p-6 flex justify-between items-center">
                        <div className="flex-grow mr-4">
                          <div className="flex items-center gap-2 mb-2">
                            <h2 className="text-xl font-semibold truncate">{note.title}</h2>
                            {note.isPinned && <Pin className="h-4 w-4 text-yellow-500" />}
                            {note.isArchived && <Archive className="h-4 w-4 text-blue-500" />}
                          </div>
                          <div className="mb-2 h-12 overflow-hidden">
                            {isMarkdownMode ? (
                              <ReactMarkdown>{note.content.substring(0, 100) + '...'}</ReactMarkdown>
                            ) : (
                              <div dangerouslySetInnerHTML={{ __html: note.content.substring(0, 100) + '...' }} />
                            )}
                          </div>
                          {note.image && (
                            <img src={note.image} alt="Note image" className="w-20 h-20 object-cover mt-2 rounded" />
                          )}
                          <div className="mt-2 flex flex-wrap gap-2">
                            {note.tags.map(tag => (
                              <span key={tag} className="bg-blue-900 text-blue-300 text-xs font-medium mr-2 px-2.5 py-0.5 rounded">
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <span className="text-sm font-medium px-2 py-1 rounded-full bg-opacity-50" style={{ backgroundColor: note.color }}>
                            {note.category}
                          </span>
                          <span className="text-sm text-gray-400">
                            {note.updatedAt.toLocaleString()}
                          </span>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation()
                                setEditingNote(note)
                              }}
                              className="text-blue-500 hover:text-blue-600"
                            >
                              <Edit3 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation()
                                deleteNote(note.id)
                              }}
                              className="text-red-500 hover:text-red-600"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation()
                                togglePinNote(note.id)
                              }}
                              className={note.isPinned ? 'text-yellow-500' : 'text-gray-400'}
                            >
                              <Pin className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation()
                                toggleArchiveNote(note.id)
                              }}
                              className={note.isArchived ? 'text-blue-500' : 'text-gray-400'}
                            >
                              <Archive className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </TabsContent>
        </Tabs>

        <Dialog open={isAddingNote} onOpenChange={setIsAddingNote}>
          <DialogContent className="bg-gray-800 text-white overflow-y-auto max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>Add New Note 📝</DialogTitle>
            </DialogHeader>
            <Input
              type="text"
              placeholder="Title"
              value={newNote.title}
              onChange={(e) => setNewNote({ ...newNote, title: e.target.value })}
              className="mb-4 bg-gray-700 text-white"
            />
            {isMarkdownMode ? (
              <textarea
                value={newNote.content}
                onChange={(e) =>
                  setNewNote({ ...newNote, content: e.target.value })
                }
                className="mb-4 w-full h-40 p-2 rounded bg-gray-700 text-white"
                placeholder="Content (Markdown supported)"
              />
            ) : (
              <ReactQuill
                theme="snow"
                value={newNote.content}
                onChange={(content) => setNewNote({ ...newNote, content })}
                modules={modules}
                formats={formats}
                className="mb-4 bg-gray-700 text-white"
              />
            )}
            <Select value={newNote.category} onValueChange={(value) => setNewNote({ ...newNote, category: value })}>
              <SelectTrigger className="bg-gray-700 text-white">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent className="bg-gray-700 text-white">
                {categories.map((cat) => (
                  <SelectItem key={cat.name} value={cat.name}>{cat.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="mt-4 flex items-center gap-4">
              <Label htmlFor="new-image-upload" className="cursor-pointer">
                <Upload className="h-6 w-4 mr-2 inline-block" />
                Upload Image
              </Label>
              <Input
                id="new-image-upload"
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline">Add Emoji</Button>
                </PopoverTrigger>
                <PopoverContent className="bg-gray-700">
                  <EmojiPicker
                    onEmojiClick={(emojiObject) => {
                      setNewNote({
                        ...newNote,
                        content: newNote.content + emojiObject.emoji
                      })
                    }}
                    theme={"dark" as Theme}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="mt-4">
              <Label htmlFor="new-tags-input">Tags (comma-separated)</Label>
              <Input
                id="new-tags-input"
                value={newNote.tags.join(', ')}
                onChange={(e) => handleTagChange(e.target.value.split(','))}
                className="mt-2 bg-gray-700 text-white"
                placeholder="Enter tags..."
              />
            </div>
            {newNote.image && (
              <img src={newNote.image} alt="New note image" className="w-full h-40 object-cover mt-4 rounded" />
            )}
            <Button onClick={addNote} className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white">Add Note</Button>
          </DialogContent>
        </Dialog>

        <Dialog open={!!editingNote} onOpenChange={(open) => !open && setEditingNote(null)}>
          <DialogContent className="bg-gray-800 text-white overflow-y-auto max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>Edit Note ✏️</DialogTitle>
            </DialogHeader>
            {editingNote && (
              <>
                <Input
                  value={editingNote.title}
                  onChange={(e) => setEditingNote({ ...editingNote, title: e.target.value })}
                  className="mb-4 bg-gray-700 text-white"
                  placeholder="Title"
                />
                {isMarkdownMode ? (
                  <textarea
                    value={editingNote.content}
                    onChange={(e) => setEditingNote({ ...editingNote, content: e.target.value })}
                    className="mb-4 w-full h-40 p-2 rounded bg-gray-700 text-white"
                    placeholder="Content (Markdown supported)"
                  />
                ) : (
                  <ReactQuill
                    theme="snow"
                    value={editingNote.content}
                    onChange={(content) => setEditingNote({ ...editingNote, content })}
                    modules={modules}
                    formats={formats}
                    className="mb-4 bg-gray-700 text-white"
                  />
                )}
                <Select
                  value={editingNote.category}
                  onValueChange={(value) => setEditingNote({ ...editingNote, category: value })}
                >
                  <SelectTrigger className="bg-gray-700 text-white">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-700 text-white">
                    {categories.map((cat) => (
                      <SelectItem key={cat.name} value={cat.name}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="mt-4 flex items-center gap-4">
                  <Label htmlFor="image-upload" className="cursor-pointer">
                    <Upload className="h-6 w-6 mr-2 inline-block" />
                    Upload Image
                  </Label>
                  <Input
                    id="image-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                    ref={fileInputRef}
                  />
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline">Add Emoji</Button>
                    </PopoverTrigger>
                    <PopoverContent className="bg-gray-700">
                      <EmojiPicker
                        onEmojiClick={(emojiObject) => {
                          setEditingNote({
                            ...editingNote,
                            content: editingNote.content + emojiObject.emoji
                          })
                        }}
                        theme={"dark" as Theme}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="mt-4">
                  <Label htmlFor="tags-input">Tags (comma-separated)</Label>
                  <Input
                    id="tags-input"
                    value={editingNote.tags.join(', ')}
                    onChange={(e) => handleTagChange(e.target.value.split(','), editingNote.id)}
                    className="mt-2 bg-gray-700 text-white"
                    placeholder="Enter tags..."
                  />
                </div>
                {editingNote.image && (
                  <img src={editingNote.image} alt="Note image" className="w-full h-40 object-cover mt-4 rounded" />
                )}
                <Button onClick={updateNote} className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white">Save Changes</Button>
              </>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={!!previewNote} onOpenChange={(open) => !open && setPreviewNote(null)}>
          <DialogContent className="max-w-3xl bg-gray-800 text-white">
            <DialogHeader>
              <DialogTitle>{previewNote?.title}</DialogTitle>
            </DialogHeader>
            {previewNote && (
              <>
                <div className="mb-4 overflow-y-auto max-h-[60vh]">
                  {isMarkdownMode ? (
                    <ReactMarkdown>{previewNote.content}</ReactMarkdown>
                  ) : (
                    <div dangerouslySetInnerHTML={{ __html: previewNote.content }} />
                  )}
                </div>
                {previewNote.image && (
                  <div className="relative">
                    <img
                      src={previewNote.image}
                      alt="Note image"
                      className={`w-full object-cover rounded transition-all duration-300 ${isZoomed ? 'h-auto max-h-[80vh]' : 'h-40'}`}
                      onClick={() => setIsZoomed(!isZoomed)}
                    />
                    <Button
                      className="absolute top-2 right-2 bg-opacity-50 hover:bg-opacity-75"
                      onClick={() => setIsZoomed(!isZoomed)}
                    >
                      {isZoomed ? <ZoomOut className="h-4 w-4" /> : <ZoomIn className="h-4 w-4" />}
                    </Button>
                  </div>
                )}
                <div className="mt-4 flex justify-between items-center">
                  <span className="text-sm font-medium px-2 py-1 rounded-full bg-opacity-50" style={{ backgroundColor: previewNote.color }}>
                    {previewNote.category}
                  </span>
                  <span className="text-sm text-gray-400">
                    {previewNote.updatedAt.toLocaleString()}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {previewNote.tags.map(tag => (
                    <span key={tag} className="bg-blue-900 text-blue-300 text-xs font-medium mr-2 px-2.5 py-0.5 rounded">
                      {tag}
                    </span>
                  ))}
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>

        <Dialog>
          <DialogTrigger asChild>
            <Button className="mt-4">
              Manage Categories 🏷️
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-gray-800 text-white">
            <DialogHeader>
              <DialogTitle>Manage Categories</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {categories.map((category) => (
                <div key={category.name} className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="w-4 h-4 rounded-full mr-2 bg-opacity-50" style={{ backgroundColor: category.color }}></div>
                    <span>{category.name}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteCategory(category.name)}
                    className="text-red-500 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="mt-4">
              <Input
                type="text"
                placeholder="New Category Name"
                value={newCategory.name}
                onChange={(e) => setNewCategory({...newCategory, name: e.target.value})}
                className="mb-2 bg-gray-700 text-white"
              />
              <div className="flex items-center mb-2">
                <Label htmlFor="category-color" className="mr-2">Color:</Label>
                <Input
                  id="category-color"
                  type="color"
                  value={newCategory.color}
                  onChange={(e) => setNewCategory({...newCategory, color: e.target.value})}
                  className="w-12 h-8 p-0 border-none"
                />
              </div>
              <Button onClick={addCategory} className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                Add Category
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <div className="mt-8 flex justify-between items-center">
          <div className="flex space-x-2">
            <Button onClick={exportNotes} className="bg-green-600 hover:bg-green-700 text-white">
              <Download className="mr-2 h-4 w-4" />
              Export Notes
            </Button>
            <Label htmlFor="import-notes" className="cursor-pointer bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-md flex items-center">
              <Upload className="mr-2 h-4 w-4" />
              Import Notes
            </Label>
            <Input
              id="import-notes"
              type="file"
              accept=".json"
              onChange={importNotes}
              className="hidden"
            />
          </div>
          <div className="flex items-center space-x-2">
            <Switch
              id="markdown-mode"
              checked={isMarkdownMode}
              onCheckedChange={setIsMarkdownMode}
            />
            <Label htmlFor="markdown-mode" className="text-white">Markdown Mode</Label>
          </div>
        </div>

        <div className="mt-8">
          <h2 className="text-2xl font-bold mb-4">All Tags 🏷️</h2>
          <div className="flex flex-wrap gap-2">
            {allTags.map(tag => (
              <span key={tag} className="bg-blue-900 text-blue-300 text-sm font-medium mr-2 px-2.5 py-0.5 rounded">
                {tag}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-8">
          <Button onClick={getJoke} className="mr-4 bg-purple-600 hover:bg-purple-700 text-white">
            Get a Joke 😄
          </Button>
          {joke && (
            <Card className="mt-4 bg-gray-800 text-white">
              <CardContent className="p-4">
                <p>{joke}</p>
              </CardContent>
            </Card>
          )}
        </div>

        <Button
          className="fixed bottom-8 right-8 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-full p-4 shadow-lg"
          onClick={() => setIsAddingNote(true)}
        >
          <Plus className="h-6 w-6" />
        </Button>
      </div>

      <footer className="mt-16 py-8 bg-gray-800">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="mb-4 md:mb-0">
              <h3 className="text-lg font-semibold mb-2">Notelytic 📝</h3>
              <p className="text-sm">Your personal note-taking companion</p>
            </div>
            <div className="mb-4 md:mb-0 text-center">
              <p className="text-sm mb-2">© 2024 Sunny Patel - sunnypatel124555@gmail.com</p>
              <Button variant="link" onClick={() => setShowTosDialog(true)}>
                Terms of Service
              </Button>
            </div>
            <div className="flex justify-center space-x-4">
              <Button variant="ghost" size="icon" asChild>
                <a href="https://github.com/sunnypatell" target="_blank" rel="noopener noreferrer">
                  <Github className="h-5 w-5" />
                  <span className="sr-only">GitHub</span>
                </a>
              </Button>
              <Button variant="ghost" size="icon" asChild>
                <a href="https://www.linkedin.com/in/sunny-patel-30b460204/" target="_blank" rel="noopener noreferrer">
                  <Linkedin className="h-5 w-5" />
                  <span className="sr-only">LinkedIn</span>
                </a>
              </Button>
              <Button variant="ghost" size="icon" asChild>
                <a href="https://www.sunnypatel.net/" target="_blank" rel="noopener noreferrer">
                  <Globe className="h-5 w-5" />
                  <span className="sr-only">Portfolio</span>
                </a>
              </Button>
            </div>
          </div>
        </div>
      </footer>

      <Dialog open={showTosDialog} onOpenChange={setShowTosDialog}>
        <DialogContent className="max-w-3xl bg-gray-800 text-white">
          <DialogHeader>
            <DialogTitle>Terms of Service ⚠️</DialogTitle>
          </DialogHeader>
          <div className="h-[400px] w-full rounded-md border p-4 overflow-auto">
            <div className="space-y-4">
              <h2 className="text-xl font-bold">1. Acceptance of Terms</h2>
              <p>By accessing or using Notelytic, you agree to be bound by these Terms of Service. If you disagree with any part of the terms, you may not access the service. This web application is developed from scratch and maintained in its entirety by Sunny Jayendra Patel.</p>

              <h2 className="text-xl font-bold">2. Description of Service</h2>
              <p>Notelytic is a personal note-taking web application designed and developed by Sunny Jayendra Patel. It allows users to create, edit, organize, and store notes.</p>

              <h2 className="text-xl font-bold">3. User Responsibilities</h2>
              <p>You are responsible for maintaining the confidentiality of personal notes. You agree to accept responsibility for all activities that occur under your account.</p>

              <h2 className="text-xl font-bold">4. Intellectual Property</h2>
              <p>Notelytic is the sole property of Sunny Jayendra Patel. The service, including its original content, features, and functionality, is protected by international copyright, trademark, patent, trade secret, and other intellectual property or proprietary rights laws.</p>

              <h2 className="text-xl font-bold">5. Prohibited Uses</h2>
              <p>You may not use Notelytic for any illegal or unauthorized purpose.</p>

              <h2 className="text-xl font-bold">6. Disclaimer</h2>
              <p>Notelytic is provided on an &quot;as is&quot; and &quot;as available&quot; basis. The author makes no warranties, expressed or implied, and hereby disclaims and negates all other warranties, including without limitation, implied warranties or conditions of merchantability, fitness for a particular purpose, or non-infringement of intellectual property or other violation of rights.</p>

              <h2 className="text-xl font-bold">7. Changes to Terms</h2>
              <p>The author reserves the right, at his sole discretion, to modify or replace these Terms at any time. It is your responsibility to check these Terms periodically for changes.</p>

              <h2 className="text-xl font-bold">8. Contact Information</h2>
              <p>If you have any questions about these Terms, please contact Sunny Jayendra Patel at sunnypatel124555@gmail.com.</p>

              <h2 className="text-xl font-bold">9. Copyright Notice</h2>
              <p>This web project is protected by copyright. You may not copy, modify, or distribute this work without explicit permission from the author, Sunny Jayendra Patel. Any unauthorized use, reproduction, or distribution of this work may result in severe civil and criminal penalties, and will be prosecuted to the maximum extent possible under the law.</p>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowTosDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ToastContainer position="bottom-right" theme="dark" />
    </div>
  )
}