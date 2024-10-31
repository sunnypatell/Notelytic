'use client'

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Moon, Sun, Search, Plus, BarChart, Calendar, Clock, Tag, Trash2, Edit3, Image as ImageIcon, Pin, Archive, Share2, Download, Upload, ZoomIn, ZoomOut, Github, Linkedin, Globe } from 'lucide-react'
import Image from 'next/image'
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

const saveToIndexedDB = async (storeName: string, data: unknown) => {
  if (!db) await openDB()
  return new Promise((resolve, reject) => {
    const transaction = db!.transaction(storeName, 'readwrite')
    const store = transaction.objectStore(storeName)
    const request = store.put(data)

    request.onerror = () => reject('Error saving data')
    request.onsuccess = () => resolve(null)
  })
}

const getAllFromIndexedDB = async (storeName: string): Promise<unknown[]> => {
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
  const [isDarkMode, setIsDarkMode] = useState(false)
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
      const savedNotes = await getAllFromIndexedDB('notes') as Note[]
      const savedCategories = await getAllFromIndexedDB('categories') as Category[]

      if (savedNotes.length > 0) {
        setNotes(savedNotes.map((note: Note) => ({
          ...note,
          createdAt: new Date(note.createdAt),
          updatedAt: new Date(note.updatedAt)
        })))
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
        setCategories(savedCategories)
      } else {
        initialCategories.forEach(category => saveToIndexedDB('categories', category))
      }
    }

    initializeData()

    // Update current time every second
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    // Update allTags whenever notes change
    const tags = new Set<string>()
    notes.forEach(note => note.tags.forEach(tag => tags.add(tag)))
    setAllTags(Array.from(tags))
  }, [notes])

  useEffect(() => {
    // Apply dark mode to body
    document.body.classList.toggle('dark', isDarkMode)

    // Apply dark mode styles to ReactQuill
    const style = document.createElement('style')
    style.textContent = `
      .ql-toolbar.ql-snow {
        border-color: #4a5568;
        background-color: #2d3748;
      }
      .ql-container.ql-snow {
        border-color: #4a5568;
      }
      .ql-editor {
        background-color: #1a202c;
        color: #e2e8f0;
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
      }
      .ql-picker-item {
        color: #e2e8f0 !important;
      }
      .ql-picker-item:hover {
        color: #90cdf4 !important;
      }
    `
    document.head.appendChild(style)

    return () => {
      document.head.removeChild(style)
    }
  }, [isDarkMode])

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
      setNotes(prevNotes => prevNotes.map(note => 
        note.id === editingNote.id ? updatedNote : note
      ))
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
        toast.error('You can only pin up to  3 notes 📌')
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
            const updatedNotes = await getAllFromIndexedDB('notes') as Note[]
            const updatedCategories = await getAllFromIndexedDB('categories') as Category[]
            setNotes(updatedNotes.map(note => ({
              ...note,
              createdAt: new Date(note.createdAt),
              updatedAt: new Date(note.updatedAt)
            })))
            setCategories(updatedCategories)
            toast.success('Notes and categories imported successfully! 📥')
          } else {
            throw new Error('Invalid import format')
          }
        } catch (error) {
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
                <h2 className="text-2xl font-bold">{currentTime.toLocaleDateString()}</h2>
                <p className="text-sm text-gray-400">Current Date 📅</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gray-800 text-white">
            <CardContent className="flex items-center justify-center p-6">
              <div className="text-center">
                <Clock className="h-8 w-8 mb-2 mx-auto text-yellow-500" />
                <h2 className="text-2xl font-bold">{currentTime.toLocaleTimeString()}</h2>
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
                          <Image
                            src={note.image}
                            alt="Note image"
                            width={400}
                            height={300}
                            className="w-full h-40 object-cover mb-4 rounded"
                          />
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
                            <span key={tag} className="text-xs bg-gray-700 text-gray-300 px-2 py-1 rounded-full">
                              #{tag}
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
              {filteredNotes.map((note) => (
                <Card key={note.id} className="bg-gray-800 cursor-pointer" onClick={() => setPreviewNote(note)}>
                  <CardContent className="p-4 flex justify-between items-center">
                    <div>
                      <h2 className="text-lg font-semibold">{note.title}</h2>
                      <p className="text-sm text-gray-400">{note.updatedAt.toLocaleString()}</p>
                    </div>
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
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        <Dialog open={isAddingNote} onOpenChange={setIsAddingNote}>
          <DialogTrigger asChild>
            <Button className="fixed bottom-8 right-8 rounded-full p-4 bg-blue-500 hover:bg-blue-600">
              <Plus className="h-6 w-6" />
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-gray-800 text-white">
            <DialogHeader>
              <DialogTitle>Add New Note 📝</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Input
                placeholder="Title"
                value={newNote.title}
                onChange={(e) => setNewNote({ ...newNote, title: e.target.value })}
                className="bg-gray-700 text-white"
              />
              <ReactQuill
                theme="snow"
                value={newNote.content}
                onChange={(content) => setNewNote({ ...newNote, content })}
                modules={modules}
                formats={formats}
                className="bg-gray-700 text-white"
              />
              <Select
                value={newNote.category}
                onValueChange={(value) => setNewNote({ ...newNote, category: value })}
              >
                <SelectTrigger className="w-full bg-gray-700 text-white">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent className="bg-gray-700 text-white">
                  {categories.map((cat) => (
                    <SelectItem key={cat.name} value={cat.name}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div>
                <Label htmlFor="tags" className="text-white mb-2 block">Tags</Label>
                <Input
                  id="tags"
                  placeholder="Enter tags (comma-separated)"
                  value={newNote.tags.join(', ')}
                  onChange={(e) => handleTagChange(e.target.value.split(','))}
                  className="bg-gray-700 text-white"
                />
              </div>
              <div>
                <Label htmlFor="image-upload" className="text-white mb-2 block">Upload Image</Label>
                <Input
                  id="image-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="bg-gray-700 text-white"
                />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={addNote} className="bg-blue-500 hover:bg-blue-600 text-white">Add Note</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={editingNote !== null} onOpenChange={() => setEditingNote(null)}>
          <DialogContent className="bg-gray-800 text-white">
            <DialogHeader>
              <DialogTitle>Edit Note 📝</DialogTitle>
            </DialogHeader>
            {editingNote && (
              <div className="space-y-4">
                <Input
                  placeholder="Title"
                  value={editingNote.title}
                  onChange={(e) => setEditingNote({ ...editingNote, title: e.target.value })}
                  className="bg-gray-700 text-white"
                />
                <ReactQuill
                  theme="snow"
                  value={editingNote.content}
                  onChange={(content) => setEditingNote({ ...editingNote, content })}
                  modules={modules}
                  formats={formats}
                  className="bg-gray-700 text-white"
                />
                <Select
                  value={editingNote.category}
                  onValueChange={(value) => setEditingNote({ ...editingNote, category: value })}
                >
                  <SelectTrigger className="w-full bg-gray-700 text-white">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-700 text-white">
                    {categories.map((cat) => (
                      <SelectItem key={cat.name} value={cat.name}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div>
                  <Label htmlFor="edit-tags" className="text-white mb-2 block">Tags</Label>
                  <Input
                    id="edit-tags"
                    placeholder="Enter tags (comma-separated)"
                    value={editingNote.tags.join(', ')}
                    onChange={(e) => handleTagChange(e.target.value.split(','), editingNote.id)}
                    className="bg-gray-700 text-white"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-image-upload" className="text-white mb-2 block">Upload Image</Label>
                  <Input
                    id="edit-image-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="bg-gray-700 text-white"
                  />
                </div>
                {editingNote.image && (
                  <Image
                    src={editingNote.image}
                    alt="Note image"
                    width={400}
                    height={300}
                    className="w-full h-40 object-cover rounded"
                  />
                )}
              </div>
            )}
            <DialogFooter>
              <Button onClick={updateNote} className="bg-blue-500 hover:bg-blue-600 text-white">Update Note</Button>
              <Button onClick={() => deleteNote(editingNote!.id)} className="bg-red-500 hover:bg-red-600 text-white">Delete Note</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={previewNote !== null} onOpenChange={() => setPreviewNote(null)}>
          <DialogContent className="bg-gray-800 text-white max-w-4xl">
            <DialogHeader>
              <DialogTitle>{previewNote?.title}</DialogTitle>
            </DialogHeader>
            {previewNote && (
              <div className="space-y-4">
                {isMarkdownMode ? (
                  <ReactMarkdown>{previewNote.content}</ReactMarkdown>
                ) : (
                  <div dangerouslySetInnerHTML={{ __html: previewNote.content }} />
                )}
                {previewNote.image && (
                  <Image
                    src={previewNote.image}
                    alt="Note image"
                    width={400}
                    height={300}
                    className="w-full object-cover rounded"
                  />
                )}
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium px-2 py-1 rounded-full bg-opacity-50" style={{ backgroundColor: previewNote.color }}>
                    {previewNote.category}
                  </span>
                  <span className="text-sm text-gray-400">
                    {previewNote.updatedAt.toLocaleString()}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {previewNote.tags.map(tag => (
                    <span key={tag} className="text-xs bg-gray-700 text-gray-300 px-2 py-1 rounded-full">
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <DialogFooter>
              <Button onClick={() => setPreviewNote(null)} className="bg-gray-600 hover:bg-gray-700 text-white">Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog>
          <DialogTrigger asChild>
            <Button className="mr-4 bg-purple-500 hover:bg-purple-600 text-white">Manage Categories 🏷️</Button>
          </DialogTrigger>
          <DialogContent className="bg-gray-800 text-white">
            <DialogHeader>
              <DialogTitle>Manage Categories 🏷️</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex space-x-2">
                <Input
                  placeholder="New category name"
                  value={newCategory.name}
                  onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                  className="bg-gray-700 text-white"
                />
                <Input
                  type="color"
                  value={newCategory.color}
                  onChange={(e) => setNewCategory({ ...newCategory, color: e.target.value })}
                  className="w-16 bg-gray-700 text-white"
                />
                <Button onClick={addCategory} className="bg-green-500 hover:bg-green-600 text-white">Add</Button>
              </div>
              <div className="space-y-2">
                {categories.map((category) => (
                  <div key={category.name} className="flex justify-between items-center">
                    <span className="text-sm font-medium px-2 py-1 rounded-full" style={{ backgroundColor: category.color }}>
                      {category.name}
                    </span>
                    <Button
                      onClick={() => deleteCategory(category.name)}
                      className="bg-red-500 hover:bg-red-600 text-white"
                    >
                      Delete
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Button onClick={exportNotes} className="mr-4 bg-green-500 hover:bg-green-600 text-white">
          Export Notes 📤
        </Button>

        <Button onClick={() => fileInputRef.current?.click()} className="mr-4 bg-yellow-500 hover:bg-yellow-600 text-white">
          Import Notes 📥
        </Button>
        <Input
          type="file"
          ref={fileInputRef}
          onChange={importNotes}
          style={{ display: 'none' }}
          accept=".json"
        />

        <Button onClick={getJoke} className="mr-4 bg-pink-500 hover:bg-pink-600 text-white">
          Get a Joke 😄
        </Button>

        <Popover>
          <PopoverTrigger asChild>
            <Button className="bg-gray-600 hover:bg-gray-700 text-white">Settings ⚙️</Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 bg-gray-800 text-white">
            <div className="grid gap-4">
              <div className="space-y-2">
                <h4 className="font-medium leading-none">Appearance</h4>
                <p className="text-sm text-gray-400">Customize the app&apos;s appearance.</p>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="dark-mode"
                  checked={isDarkMode}
                  onCheckedChange={setIsDarkMode}
                />
                <Label htmlFor="dark-mode">Dark Mode 🌙</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="markdown-mode"
                  checked={isMarkdownMode}
                  onCheckedChange={setIsMarkdownMode}
                />
                <Label htmlFor="markdown-mode">Markdown Mode 📝</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="zoom-mode"
                  checked={isZoomed}
                  onCheckedChange={setIsZoomed}
                />
                <Label htmlFor="zoom-mode">Zoom Mode 🔍</Label>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        <Dialog open={showTosDialog} onOpenChange={setShowTosDialog}>
          <DialogContent className="bg-gray-800 text-white">
            <DialogHeader>
              <DialogTitle>Terms of Service</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p>This web project is protected by copyright. You may not copy, modify, or distribute this work without explicit permission from the author.</p>
            </div>
            <DialogFooter>
              <Button onClick={() => setShowTosDialog(false)} className="bg-blue-500 hover:bg-blue-600 text-white">I Agree</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <footer className="mt-16 text-center text-gray-400">
          <p>© 2024 Notelytic. All rights reserved.</p>
          <div className="flex justify-center space-x-4 mt-4">
            <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="hover:text-white">
              <Github className="h-6 w-6" />
            </a>
            <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" className="hover:text-white">
              <Linkedin className="h-6 w-6" />
            </a>
            <a href="https://example.com" target="_blank" rel="noopener noreferrer" className="hover:text-white">
              <Globe className="h-6 w-6" />
            </a>
          </div>
        </footer>

        <ToastContainer position="bottom-right" theme={isDarkMode ? "dark" : "light"} />
      </div>
    </div>
  )
}