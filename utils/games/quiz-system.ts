import { getFirebaseDatabase } from "@/lib/firebase"
import { ref, set, onValue, remove, push } from "firebase/database"

export interface QuizQuestion {
  id: string
  question: string
  options: string[]
  correctAnswer: string
  category?: string
  difficulty?: "easy" | "medium" | "hard"
}

export interface QuizSession {
  id: string
  roomId: string
  hostId: string
  hostName: string
  topic?: string
  questions: QuizQuestion[]
  currentQuestionIndex: number
  status: "waiting" | "active" | "finished"
  timePerQuestion: number
  totalQuestions: number
  createdAt: number
  participants: string[]
}

export interface QuizAnswer {
  playerId: string
  playerName: string
  questionId: string
  answer: string
  isCorrect: boolean
  timeToAnswer: number
  timestamp: number
}

export interface QuizResult {
  playerId: string
  playerName: string
  score: number
  totalAnswered: number
  averageTime: number
}

export class QuizSystem {
  private static instance: QuizSystem
  private quizListeners: Array<() => void> = []

  static getInstance(): QuizSystem {
    if (!QuizSystem.instance) {
      QuizSystem.instance = new QuizSystem()
    }
    return QuizSystem.instance
  }

  // Set active quiz for the room
  private async setActiveQuiz(roomId: string, sessionId: string): Promise<void> {
    if (!getFirebaseDatabase()!) return
    const activeQuizRef = ref(getFirebaseDatabase()!, `rooms/${roomId}/activeQuiz`)
    await set(activeQuizRef, sessionId)
  }

  // Clear active quiz for the room
  private async clearActiveQuiz(roomId: string): Promise<void> {
    if (!getFirebaseDatabase()!) return
    const activeQuizRef = ref(getFirebaseDatabase()!, `rooms/${roomId}/activeQuiz`)
    await remove(activeQuizRef)
  }

  // Listen for active quiz in the room
  listenForActiveQuiz(roomId: string, onUpdate: (sessionId: string | null) => void) {
    if (!getFirebaseDatabase()!) {
      console.warn("Firebase database not initialized, active quiz listening disabled")
      return () => { }
    }

    const activeQuizRef = ref(getFirebaseDatabase()!, `rooms/${roomId}/activeQuiz`)
    const unsubscribe = onValue(activeQuizRef, (snapshot) => {
      const sessionId = snapshot.val()
      onUpdate(sessionId)
    })

    this.quizListeners.push(unsubscribe)
    return unsubscribe
  }

  // Create a new quiz session
  async createQuizSession(roomId: string, hostId: string, hostName: string, topic?: string): Promise<string> {
    if (!getFirebaseDatabase()!) {
      throw new Error("Firebase database not initialized")
    }

    const sessionId = `quiz_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    console.log(`[QuizSystem] Creating session ${sessionId} for room ${roomId}. Topic: ${topic || 'random'}`)

    // Generate questions
    const questions = await this.generateQuestions(topic)
    console.log(`[QuizSystem] Generated ${questions.length} questions for session ${sessionId}`)

    const session: QuizSession = {
      id: sessionId,
      roomId,
      hostId,
      hostName,
      topic: topic || "random",
      questions,
      currentQuestionIndex: 0,
      status: "waiting",
      timePerQuestion: 10,
      totalQuestions: questions.length, // Use actual length
      createdAt: Date.now(),
      participants: [hostId],
    }

    const sessionRef = ref(getFirebaseDatabase()!, `rooms/${roomId}/quiz/${sessionId}`)
    await set(sessionRef, session)
    console.log(`[QuizSystem] Session ${sessionId} saved to database.`)

    await this.setActiveQuiz(roomId, sessionId)
    return sessionId
  }

  // Generate quiz questions
  private async generateQuestions(topic?: string): Promise<QuizQuestion[]> {
    try {
      // Try to fetch from Open Trivia Database API
      const questions = await this.fetchFromTriviaAPI(topic)
      if (questions.length > 0) {
        return questions
      }
    } catch (error) {
      console.warn("Failed to fetch from API, using fallback questions:", error)
    }

    // Fallback to predefined questions
    return this.getFallbackQuestions(topic)
  }

  private async fetchFromTriviaAPI(topic?: string): Promise<QuizQuestion[]> {
    const categoryMap: { [key: string]: number } = {
      science: 17,
      history: 23,
      geography: 22,
      sports: 21,
      movies: 11,
      music: 12,
      books: 10,
      computers: 18,
      technology: 18,
      mathematics: 19,
      nature: 17,
      animals: 27,
      art: 25,
      politics: 24,
      celebrities: 26,
      vehicles: 28,
      comics: 29,
      gadgets: 30,
      anime: 31,
      cartoons: 32,
    }

    let url = "https://opentdb.com/api.php?amount=10&type=multiple"

    if (topic) {
      const normalizedTopic = topic.toLowerCase().trim()
      let categoryId = categoryMap[normalizedTopic]

      if (!categoryId) {
        const topicKeywords = normalizedTopic.split(" ")
        for (const [category, id] of Object.entries(categoryMap)) {
          const matches = topicKeywords.some(
            (keyword) =>
              category.includes(keyword) ||
              keyword.includes(category) ||
              (category === "computers" && (keyword.includes("programming") || keyword.includes("tech") || keyword.includes("software"))) ||
              (category === "movies" && (keyword.includes("film") || keyword.includes("cinema"))) ||
              (category === "sports" && (keyword.includes("sport") || keyword.includes("football") || keyword.includes("basketball") || keyword.includes("soccer"))) ||
              (category === "science" && (keyword.includes("physics") || keyword.includes("chemistry") || keyword.includes("biology"))) ||
              (category === "music" && (keyword.includes("song") || keyword.includes("instrument") || keyword.includes("band"))) ||
              (category === "nature" && (keyword.includes("animal") || keyword.includes("plant") || keyword.includes("environment"))),
          )
          if (matches) {
            categoryId = id
            break
          }
        }
      }

      if (categoryId) {
        url += `&category=${categoryId}`
      }
    }

    try {
      console.log(`[QuizSystem] Fetching from API: ${url}`)
      const response = await fetch(url)

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()

      if (data.response_code === 0 && data.results && data.results.length > 0) {
        console.log(`[QuizSystem] API returned ${data.results.length} questions`)
        return data.results.map((item: any, index: number) => {
          const incorrectAnswers = item.incorrect_answers.map((ans: string) => this.decodeHTML(ans))
          const correctAnswer = this.decodeHTML(item.correct_answer)
          const options = [...incorrectAnswers, correctAnswer].sort(() => Math.random() - 0.5)

          return {
            id: `q_${index}_${Date.now()}`,
            question: this.decodeHTML(item.question),
            options,
            correctAnswer,
            category: item.category,
            difficulty: item.difficulty,
          }
        })
      } else {
        console.warn(`[QuizSystem] API returned non-zero code or no results:`, data.response_code)
        throw new Error(`API response code: ${data.response_code}`)
      }
    } catch (error) {
      console.error("[QuizSystem] Error fetching from Trivia API:", error)
      throw error // Let generateQuestions handle the fallback
    }
  }

  private decodeHTML(html: string): string {
    const txt = document.createElement("textarea")
    txt.innerHTML = html
    return txt.value
  }

  private getFallbackQuestions(topic?: string): QuizQuestion[] {
    const allQuestions = {
      science: [
        {
          question: "What is the chemical symbol for gold?",
          options: ["Go", "Gd", "Au", "Ag"],
          correctAnswer: "Au",
          category: "Science",
        },
        {
          question: "How many bones are there in an adult human body?",
          options: ["206", "208", "210", "204"],
          correctAnswer: "206",
          category: "Science",
        },
        {
          question: "What planet is known as the Red Planet?",
          options: ["Venus", "Mars", "Jupiter", "Saturn"],
          correctAnswer: "Mars",
          category: "Science",
        },
        {
          question: "What gas makes up about 78% of Earth's atmosphere?",
          options: ["Oxygen", "Carbon Dioxide", "Nitrogen", "Hydrogen"],
          correctAnswer: "Nitrogen",
          category: "Science",
        },
        {
          question: "What is the hardest natural substance on Earth?",
          options: ["Gold", "Iron", "Diamond", "Platinum"],
          correctAnswer: "Diamond",
          category: "Science",
        },
        {
          question: "What is the speed of light in vacuum?",
          options: ["299,792,458 m/s", "300,000,000 m/s", "299,000,000 m/s", "298,792,458 m/s"],
          correctAnswer: "299,792,458 m/s",
          category: "Science",
        },
        {
          question: "Which element has the atomic number 1?",
          options: ["Helium", "Hydrogen", "Lithium", "Carbon"],
          correctAnswer: "Hydrogen",
          category: "Science",
        },
        {
          question: "What is the largest organ in the human body?",
          options: ["Brain", "Liver", "Lungs", "Skin"],
          correctAnswer: "Skin",
          category: "Science",
        },
        {
          question: "What type of animal is a Komodo dragon?",
          options: ["Snake", "Lizard", "Crocodile", "Turtle"],
          correctAnswer: "Lizard",
          category: "Science",
        },
        {
          question: "What is the chemical formula for water?",
          options: ["H2O", "CO2", "NaCl", "CH4"],
          correctAnswer: "H2O",
          category: "Science",
        },
      ],
      history: [
        {
          question: "In which year did World War II end?",
          options: ["1944", "1945", "1946", "1947"],
          correctAnswer: "1945",
          category: "History",
        },
        {
          question: "Who was the first person to walk on the moon?",
          options: ["Buzz Aldrin", "Neil Armstrong", "John Glenn", "Alan Shepard"],
          correctAnswer: "Neil Armstrong",
          category: "History",
        },
        {
          question: "Which ancient wonder of the world was located in Alexandria?",
          options: ["Hanging Gardens", "Colossus of Rhodes", "Lighthouse", "Statue of Zeus"],
          correctAnswer: "Lighthouse",
          category: "History",
        },
        {
          question: "Who painted the ceiling of the Sistine Chapel?",
          options: ["Leonardo da Vinci", "Michelangelo", "Raphael", "Donatello"],
          correctAnswer: "Michelangelo",
          category: "History",
        },
        {
          question: "In which year did the Berlin Wall fall?",
          options: ["1987", "1988", "1989", "1990"],
          correctAnswer: "1989",
          category: "History",
        },
        {
          question: "Who was the first President of the United States?",
          options: ["Thomas Jefferson", "George Washington", "John Adams", "Benjamin Franklin"],
          correctAnswer: "George Washington",
          category: "History",
        },
        {
          question: "Which empire was ruled by Julius Caesar?",
          options: ["Greek Empire", "Roman Empire", "Byzantine Empire", "Ottoman Empire"],
          correctAnswer: "Roman Empire",
          category: "History",
        },
        {
          question: "In which year did the Titanic sink?",
          options: ["1910", "1911", "1912", "1913"],
          correctAnswer: "1912",
          category: "History",
        },
        {
          question: "Who wrote the Declaration of Independence?",
          options: ["George Washington", "Benjamin Franklin", "Thomas Jefferson", "John Adams"],
          correctAnswer: "Thomas Jefferson",
          category: "History",
        },
        {
          question: "Which war was fought between 1861-1865 in America?",
          options: ["Revolutionary War", "Civil War", "War of 1812", "Spanish-American War"],
          correctAnswer: "Civil War",
          category: "History",
        },
      ],
      geography: [
        {
          question: "What is the capital of Australia?",
          options: ["Sydney", "Melbourne", "Canberra", "Perth"],
          correctAnswer: "Canberra",
          category: "Geography",
        },
        {
          question: "Which is the longest river in the world?",
          options: ["Amazon", "Nile", "Mississippi", "Yangtze"],
          correctAnswer: "Nile",
          category: "Geography",
        },
        {
          question: "How many continents are there?",
          options: ["5", "6", "7", "8"],
          correctAnswer: "7",
          category: "Geography",
        },
        {
          question: "Which country has the most natural lakes?",
          options: ["Russia", "Canada", "Finland", "Sweden"],
          correctAnswer: "Canada",
          category: "Geography",
        },
        {
          question: "What is the smallest country in the world?",
          options: ["Monaco", "Nauru", "Vatican City", "San Marino"],
          correctAnswer: "Vatican City",
          category: "Geography",
        },
        {
          question: "Which mountain range contains Mount Everest?",
          options: ["Andes", "Rocky Mountains", "Alps", "Himalayas"],
          correctAnswer: "Himalayas",
          category: "Geography",
        },
        {
          question: "What is the largest desert in the world?",
          options: ["Sahara", "Gobi", "Antarctica", "Arabian"],
          correctAnswer: "Antarctica",
          category: "Geography",
        },
        {
          question: "Which ocean is the largest?",
          options: ["Atlantic", "Indian", "Arctic", "Pacific"],
          correctAnswer: "Pacific",
          category: "Geography",
        },
        {
          question: "What is the capital of Japan?",
          options: ["Osaka", "Tokyo", "Kyoto", "Hiroshima"],
          correctAnswer: "Tokyo",
          category: "Geography",
        },
        {
          question: "Which African country is completely surrounded by South Africa?",
          options: ["Botswana", "Lesotho", "Swaziland", "Zimbabwe"],
          correctAnswer: "Lesotho",
          category: "Geography",
        },
      ],
      sports: [
        {
          question: "How many players are on a basketball team on the court at one time?",
          options: ["4", "5", "6", "7"],
          correctAnswer: "5",
          category: "Sports",
        },
        {
          question: "In which sport would you perform a slam dunk?",
          options: ["Volleyball", "Tennis", "Basketball", "Baseball"],
          correctAnswer: "Basketball",
          category: "Sports",
        },
        {
          question: "How often are the Summer Olympic Games held?",
          options: ["Every 2 years", "Every 3 years", "Every 4 years", "Every 5 years"],
          correctAnswer: "Every 4 years",
          category: "Sports",
        },
        {
          question: "What is the maximum score possible in ten-pin bowling?",
          options: ["200", "250", "300", "350"],
          correctAnswer: "300",
          category: "Sports",
        },
        {
          question: "In soccer, how many players are on the field for each team?",
          options: ["9", "10", "11", "12"],
          correctAnswer: "11",
          category: "Sports",
        },
        {
          question: "Which sport is known as 'The Beautiful Game'?",
          options: ["Basketball", "Tennis", "Soccer", "Baseball"],
          correctAnswer: "Soccer",
          category: "Sports",
        },
        {
          question: "How many holes are played in a standard round of golf?",
          options: ["16", "18", "20", "22"],
          correctAnswer: "18",
          category: "Sports",
        },
        {
          question: "In tennis, what is a score of zero called?",
          options: ["Nil", "Zero", "Love", "Nothing"],
          correctAnswer: "Love",
          category: "Sports",
        },
        {
          question: "Which country has won the most FIFA World Cups?",
          options: ["Germany", "Argentina", "Italy", "Brazil"],
          correctAnswer: "Brazil",
          category: "Sports",
        },
        {
          question: "What is the diameter of a basketball hoop in inches?",
          options: ["16", "17", "18", "19"],
          correctAnswer: "18",
          category: "Sports",
        },
      ],
      movies: [
        {
          question: "Who directed the movie 'Jaws'?",
          options: ["George Lucas", "Steven Spielberg", "Martin Scorsese", "Francis Ford Coppola"],
          correctAnswer: "Steven Spielberg",
          category: "Movies",
        },
        {
          question: "Which movie features the line 'May the Force be with you'?",
          options: ["Star Trek", "Star Wars", "Guardians of the Galaxy", "Interstellar"],
          correctAnswer: "Star Wars",
          category: "Movies",
        },
        {
          question: "What is the highest-grossing film of all time?",
          options: ["Titanic", "Avatar", "Avengers: Endgame", "Star Wars: The Force Awakens"],
          correctAnswer: "Avatar",
          category: "Movies",
        },
        {
          question: "Who played the character Jack in Titanic?",
          options: ["Brad Pitt", "Leonardo DiCaprio", "Tom Cruise", "Johnny Depp"],
          correctAnswer: "Leonardo DiCaprio",
          category: "Movies",
        },
        {
          question: "Which animated movie features the song 'Let It Go'?",
          options: ["Moana", "Frozen", "Tangled", "The Little Mermaid"],
          correctAnswer: "Frozen",
          category: "Movies",
        },
        {
          question: "In which movie does Tom Hanks say 'Life is like a box of chocolates'?",
          options: ["Cast Away", "Philadelphia", "Forrest Gump", "Big"],
          correctAnswer: "Forrest Gump",
          category: "Movies",
        },
        {
          question: "Who directed the movie 'Pulp Fiction'?",
          options: ["Martin Scorsese", "Quentin Tarantino", "Christopher Nolan", "David Fincher"],
          correctAnswer: "Quentin Tarantino",
          category: "Movies",
        },
        {
          question: "Which movie won the Academy Award for Best Picture in 2020?",
          options: ["1917", "Joker", "Parasite", "Once Upon a Time in Hollywood"],
          correctAnswer: "Parasite",
          category: "Movies",
        },
        {
          question: "What is the name of the coffee shop in the TV show 'Friends'?",
          options: ["Central Perk", "The Grind", "Java Joe's", "Coffee Bean"],
          correctAnswer: "Central Perk",
          category: "Movies",
        },
        {
          question: "Which actor played Iron Man in the Marvel Cinematic Universe?",
          options: ["Chris Evans", "Chris Hemsworth", "Robert Downey Jr.", "Mark Ruffalo"],
          correctAnswer: "Robert Downey Jr.",
          category: "Movies",
        },
      ],
      music: [
        {
          question: "Which instrument has 88 keys?",
          options: ["Organ", "Piano", "Harpsichord", "Accordion"],
          correctAnswer: "Piano",
          category: "Music",
        },
        {
          question: "Who composed 'The Four Seasons'?",
          options: ["Mozart", "Beethoven", "Vivaldi", "Bach"],
          correctAnswer: "Vivaldi",
          category: "Music",
        },
        {
          question: "Which band released the album 'Abbey Road'?",
          options: ["The Rolling Stones", "The Beatles", "Led Zeppelin", "Pink Floyd"],
          correctAnswer: "The Beatles",
          category: "Music",
        },
        {
          question: "What does the musical term 'forte' mean?",
          options: ["Soft", "Loud", "Fast", "Slow"],
          correctAnswer: "Loud",
          category: "Music",
        },
        {
          question: "Which singer is known as the 'Queen of Pop'?",
          options: ["Whitney Houston", "Madonna", "Mariah Carey", "Celine Dion"],
          correctAnswer: "Madonna",
          category: "Music",
        },
        {
          question: "How many strings does a standard guitar have?",
          options: ["4", "5", "6", "7"],
          correctAnswer: "6",
          category: "Music",
        },
        {
          question: "Which genre of music did Elvis Presley help popularize?",
          options: ["Jazz", "Blues", "Rock and Roll", "Country"],
          correctAnswer: "Rock and Roll",
          category: "Music",
        },
        {
          question: "What is the highest female singing voice?",
          options: ["Alto", "Mezzo-soprano", "Soprano", "Contralto"],
          correctAnswer: "Soprano",
          category: "Music",
        },
        {
          question: "Which instrument is Yo-Yo Ma famous for playing?",
          options: ["Violin", "Piano", "Cello", "Flute"],
          correctAnswer: "Cello",
          category: "Music",
        },
        {
          question: "What does 'a cappella' mean?",
          options: ["With instruments", "Without instruments", "Very loud", "Very soft"],
          correctAnswer: "Without instruments",
          category: "Music",
        },
      ],
      technology: [
        {
          question: "What does 'WWW' stand for?",
          options: ["World Wide Web", "World Wide Wait", "World Wide Win", "World Wide War"],
          correctAnswer: "World Wide Web",
          category: "Technology",
        },
        {
          question: "Which programming language is known as the 'language of the web'?",
          options: ["Python", "Java", "JavaScript", "C++"],
          correctAnswer: "JavaScript",
          category: "Technology",
        },
        {
          question: "What does 'CPU' stand for?",
          options: [
            "Central Processing Unit",
            "Computer Processing Unit",
            "Central Program Unit",
            "Computer Program Unit",
          ],
          correctAnswer: "Central Processing Unit",
          category: "Technology",
        },
        {
          question: "Which company developed the iPhone?",
          options: ["Samsung", "Google", "Apple", "Microsoft"],
          correctAnswer: "Apple",
          category: "Technology",
        },
        {
          question: "What does 'AI' stand for in technology?",
          options: [
            "Automated Intelligence",
            "Artificial Intelligence",
            "Advanced Intelligence",
            "Applied Intelligence",
          ],
          correctAnswer: "Artificial Intelligence",
          category: "Technology",
        },
        {
          question: "Which social media platform is limited to 280 characters per post?",
          options: ["Facebook", "Instagram", "Twitter", "LinkedIn"],
          correctAnswer: "Twitter",
          category: "Technology",
        },
        {
          question: "What does 'USB' stand for?",
          options: ["Universal Serial Bus", "Universal System Bus", "United Serial Bus", "United System Bus"],
          correctAnswer: "Universal Serial Bus",
          category: "Technology",
        },
        {
          question: "Which company created the Android operating system?",
          options: ["Apple", "Microsoft", "Google", "Samsung"],
          correctAnswer: "Google",
          category: "Technology",
        },
        {
          question: "What is the most popular web browser as of 2023?",
          options: ["Firefox", "Safari", "Edge", "Chrome"],
          correctAnswer: "Chrome",
          category: "Technology",
        },
        {
          question: "What does 'HTML' stand for?",
          options: [
            "Hypertext Markup Language",
            "High Tech Modern Language",
            "Home Tool Markup Language",
            "Hypertext Modern Language",
          ],
          correctAnswer: "Hypertext Markup Language",
          category: "Technology",
        },
      ],
      general: [
        {
          question: "What is the largest mammal in the world?",
          options: ["African Elephant", "Blue Whale", "Giraffe", "Hippopotamus"],
          correctAnswer: "Blue Whale",
          category: "General Knowledge",
        },
        {
          question: "How many sides does a hexagon have?",
          options: ["5", "6", "7", "8"],
          correctAnswer: "6",
          category: "General Knowledge",
        },
        {
          question: "What is the currency of Japan?",
          options: ["Yuan", "Won", "Yen", "Ringgit"],
          correctAnswer: "Yen",
          category: "General Knowledge",
        },
        {
          question: "Which planet is closest to the Sun?",
          options: ["Venus", "Earth", "Mercury", "Mars"],
          correctAnswer: "Mercury",
          category: "General Knowledge",
        },
        {
          question: "What is the largest ocean on Earth?",
          options: ["Atlantic", "Indian", "Arctic", "Pacific"],
          correctAnswer: "Pacific",
          category: "General Knowledge",
        },
        {
          question: "How many minutes are in a full day?",
          options: ["1440", "1400", "1480", "1420"],
          correctAnswer: "1440",
          category: "General Knowledge",
        },
        {
          question: "What is the smallest prime number?",
          options: ["0", "1", "2", "3"],
          correctAnswer: "2",
          category: "General Knowledge",
        },
        {
          question: "Which vitamin is produced when skin is exposed to sunlight?",
          options: ["Vitamin A", "Vitamin B", "Vitamin C", "Vitamin D"],
          correctAnswer: "Vitamin D",
          category: "General Knowledge",
        },
        {
          question: "What is the capital of Canada?",
          options: ["Toronto", "Vancouver", "Montreal", "Ottawa"],
          correctAnswer: "Ottawa",
          category: "General Knowledge",
        },
        {
          question: "How many hearts does an octopus have?",
          options: ["1", "2", "3", "4"],
          correctAnswer: "3",
          category: "General Knowledge",
        },
      ],
    }

    let selectedQuestions: any[] = []

    if (topic) {
      const normalizedTopic = topic.toLowerCase().trim()

      // Direct match
      if (allQuestions[normalizedTopic as keyof typeof allQuestions]) {
        selectedQuestions = allQuestions[normalizedTopic as keyof typeof allQuestions]
      } else {
        // Fuzzy matching for custom topics
        const topicKeywords = normalizedTopic.split(" ")
        const matchedCategories: any[] = []

        // Check if topic contains keywords that match our categories
        Object.entries(allQuestions).forEach(([category, questions]) => {
          const categoryMatches = topicKeywords.some(
            (keyword) =>
              category.includes(keyword) ||
              keyword.includes(category) ||
              (category === "technology" &&
                (keyword.includes("computer") || keyword.includes("tech") || keyword.includes("programming"))) ||
              (category === "movies" &&
                (keyword.includes("film") || keyword.includes("cinema") || keyword.includes("movie"))) ||
              (category === "sports" &&
                (keyword.includes("sport") ||
                  keyword.includes("game") ||
                  keyword.includes("football") ||
                  keyword.includes("basketball"))) ||
              (category === "science" &&
                (keyword.includes("physics") || keyword.includes("chemistry") || keyword.includes("biology"))) ||
              (category === "music" &&
                (keyword.includes("song") || keyword.includes("instrument") || keyword.includes("band"))),
          )

          if (categoryMatches) {
            matchedCategories.push(...questions)
          }
        })

        if (matchedCategories.length > 0) {
          selectedQuestions = matchedCategories
        }
      }
    }

    // If no topic-specific questions or topic not found, mix from all categories
    if (selectedQuestions.length === 0) {
      const allQuestionsArray = Object.values(allQuestions).flat()
      selectedQuestions = allQuestionsArray.sort(() => Math.random() - 0.5).slice(0, 10)
    }

    // Ensure we have exactly 10 questions
    while (selectedQuestions.length < 10) {
      const allQuestionsArray = Object.values(allQuestions).flat()
      const randomQuestion = allQuestionsArray[Math.floor(Math.random() * allQuestionsArray.length)]
      if (!selectedQuestions.find((q) => q.question === randomQuestion.question)) {
        selectedQuestions.push(randomQuestion)
      }
    }

    return selectedQuestions.slice(0, 10).map((q, index) => ({
      id: `fallback_${index}_${Date.now()}`,
      ...q,
    }))
  }

  // Join quiz session
  async joinQuizSession(roomId: string, sessionId: string, playerId: string): Promise<void> {
    if (!getFirebaseDatabase()!) return

    const sessionRef = ref(getFirebaseDatabase()!, `rooms/${roomId}/quiz/${sessionId}/participants`)
    const participantsSnapshot = await new Promise<any>((resolve) => {
      onValue(sessionRef, resolve, { onlyOnce: true })
    })

    const currentParticipants = participantsSnapshot.val() || []
    if (!currentParticipants.includes(playerId)) {
      const updatedParticipants = [...currentParticipants, playerId]
      await set(sessionRef, updatedParticipants)
    }
  }

  // Submit answer
  async submitAnswer(
    roomId: string,
    sessionId: string,
    playerId: string,
    playerName: string,
    questionId: string,
    answer: string,
    correctAnswer: string,
    timeToAnswer: number,
  ): Promise<void> {
    if (!getFirebaseDatabase()!) return

    const answerData: QuizAnswer = {
      playerId,
      playerName,
      questionId,
      answer,
      isCorrect: answer === correctAnswer,
      timeToAnswer,
      timestamp: Date.now(),
    }

    const answerRef = push(ref(getFirebaseDatabase()!, `rooms/${roomId}/quiz/${sessionId}/answers`))
    await set(answerRef, answerData)
  }

  // Start quiz
  async startQuiz(roomId: string, sessionId: string): Promise<void> {
    if (!getFirebaseDatabase()!) return
    console.log(`[QuizSystem] Starting quiz ${sessionId} in room ${roomId}`)
    const sessionRef = ref(getFirebaseDatabase()!, `rooms/${roomId}/quiz/${sessionId}/status`)
    await set(sessionRef, "active")
  }

  // Next question
  async nextQuestion(roomId: string, sessionId: string, currentIndex: number): Promise<void> {
    if (!getFirebaseDatabase()!) return

    const indexRef = ref(getFirebaseDatabase()!, `rooms/${roomId}/quiz/${sessionId}/currentQuestionIndex`)
    await set(indexRef, currentIndex + 1)
  }

  // End quiz
  async endQuiz(roomId: string, sessionId: string): Promise<void> {
    if (!getFirebaseDatabase()!) return

    const statusRef = ref(getFirebaseDatabase()!, `rooms/${roomId}/quiz/${sessionId}/status`)
    await set(statusRef, "finished")

    // Clear active quiz pointer
    await this.clearActiveQuiz(roomId)
  }

  // Calculate results
  async calculateResults(roomId: string, sessionId: string): Promise<QuizResult[]> {
    if (!getFirebaseDatabase()!) return []

    const answersRef = ref(getFirebaseDatabase()!, `rooms/${roomId}/quiz/${sessionId}/answers`)
    const answersSnapshot = await new Promise<any>((resolve) => {
      onValue(answersRef, resolve, { onlyOnce: true })
    })

    const answers = answersSnapshot.val()
    if (!answers) return []

    const answersList: QuizAnswer[] = Object.values(answers)
    const playerStats: { [playerId: string]: QuizResult } = {}

    answersList.forEach((answer) => {
      if (!playerStats[answer.playerId]) {
        playerStats[answer.playerId] = {
          playerId: answer.playerId,
          playerName: answer.playerName,
          score: 0,
          totalAnswered: 0,
          averageTime: 0,
        }
      }

      const stats = playerStats[answer.playerId]
      stats.totalAnswered++
      if (answer.isCorrect) {
        stats.score++
      }
      stats.averageTime = (stats.averageTime * (stats.totalAnswered - 1) + answer.timeToAnswer) / stats.totalAnswered
    })

    return Object.values(playerStats)
  }

  // Listen for quiz session updates
  listenForQuizSession(roomId: string, sessionId: string, onUpdate: (session: QuizSession) => void) {
    if (!getFirebaseDatabase()!) {
      console.warn("Firebase database not initialized, quiz listening disabled")
      return () => { }
    }

    const sessionRef = ref(getFirebaseDatabase()!, `rooms/${roomId}/quiz/${sessionId}`)

    const unsubscribe = onValue(sessionRef, (snapshot) => {
      const session = snapshot.val()
      if (session) {
        onUpdate(session)
      }
    })

    this.quizListeners.push(unsubscribe)
    return unsubscribe
  }

  // Listen for quiz answers
  listenForQuizAnswers(roomId: string, sessionId: string, onUpdate: (answers: QuizAnswer[]) => void) {
    if (!getFirebaseDatabase()!) {
      console.warn("Firebase database not initialized, quiz answers listening disabled")
      return () => { }
    }

    const answersRef = ref(getFirebaseDatabase()!, `rooms/${roomId}/quiz/${sessionId}/answers`)

    const unsubscribe = onValue(answersRef, (snapshot) => {
      const answers = snapshot.val()
      if (answers) {
        const answersList: QuizAnswer[] = Object.values(answers)
        onUpdate(answersList)
      } else {
        onUpdate([])
      }
    })

    this.quizListeners.push(unsubscribe)
    return unsubscribe
  }

  // Clean up quiz session
  async cleanupQuizSession(roomId: string, sessionId: string): Promise<void> {
    if (!getFirebaseDatabase()!) return

    const sessionRef = ref(getFirebaseDatabase()!, `rooms/${roomId}/quiz/${sessionId}`)
    await remove(sessionRef)
  }

  // Clean up listeners
  cleanup() {
    this.quizListeners.forEach((unsubscribe) => unsubscribe())
    this.quizListeners = []
  }
}
