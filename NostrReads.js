// NostrReads Implementation Guide
// This file contains core implementation examples for NostrReads

// --------------------------
// 1. EVENT CREATION EXAMPLES
// --------------------------

import { finishEvent, getPublicKey, getEventHash, signEvent } from 'nostr-tools';

// Generate a book metadata event
async function createBookEvent(privateKey, bookData) {
  const pubkey = getPublicKey(privateKey);
  
  // Create tags for book metadata
  const tags = [
    ['d', bookData.id], // Unique identifier for the book
    ['title', bookData.title],
    ['authors', ...bookData.authors],
    ['isbn', bookData.isbn || ''],
    ['published', bookData.publishDate || ''],
    ['publisher', bookData.publisher || ''],
    ['cover', bookData.coverUrl || ''],
  ];
  
  // Add genres as separate tags
  if (bookData.genres && bookData.genres.length > 0) {
    bookData.genres.forEach(genre => {
      tags.push(['genre', genre]);
    });
  }
  
  // Add summary if available
  if (bookData.summary) {
    tags.push(['summary', bookData.summary]);
  }
  
  // Create the event object
  const event = {
    kind: 30051,
    created_at: Math.floor(Date.now() / 1000),
    tags: tags,
    content: bookData.description || '',
    pubkey
  };
  
  // Sign the event
  event.id = getEventHash(event);
  event.sig = await signEvent(event, privateKey);
  
  return event;
}

// Create a bookshelf event
async function createBookshelfEvent(privateKey, shelfData) {
  const pubkey = getPublicKey(privateKey);
  
  // Basic tags for the shelf
  const tags = [
    ['d', shelfData.id], // Unique identifier for this shelf
    ['name', shelfData.name],
  ];
  
  // Add description if available
  if (shelfData.description) {
    tags.push(['description', shelfData.description]);
  }
  
  // Add books to the shelf
  if (shelfData.books && shelfData.books.length > 0) {
    shelfData.books.forEach(book => {
      // Each book tag: [book, eventId, status, additional info]
      const bookTag = ['book', book.eventId, book.status];
      
      // Add reading progress for currently-reading or read status
      if (book.progress) {
        bookTag.push(book.progress);
      }
      // Add completion date for read status
      if (book.completedDate) {
        bookTag.push(book.completedDate);
      }
      
      tags.push(bookTag);
    });
  }
  
  // Create the event object
  const event = {
    kind: 30052,
    created_at: Math.floor(Date.now() / 1000),
    tags: tags,
    content: shelfData.notes || '',
    pubkey
  };
  
  // Sign the event
  event.id = getEventHash(event);
  event.sig = await signEvent(event, privateKey);
  
  return event;
}

// Create a book review event
async function createBookReviewEvent(privateKey, reviewData) {
  const pubkey = getPublicKey(privateKey);
  
  // Basic tags for the review
  const tags = [
    ['e', reviewData.bookEventId], // Reference to the book event
    ['rating', reviewData.rating.toString()],
  ];
  
  // Add reading date if available
  if (reviewData.readDate) {
    tags.push(['read', reviewData.readDate]);
  }
  
  // Add subject/title if available
  if (reviewData.subject) {
    tags.push(['subject', reviewData.subject]);
  }
  
  // Create the event object
  const event = {
    kind: 30053,
    created_at: Math.floor(Date.now() / 1000),
    tags: tags,
    content: reviewData.content || '',
    pubkey
  };
  
  // Sign the event
  event.id = getEventHash(event);
  event.sig = await signEvent(event, privateKey);
  
  return event;
}

// --------------------------
// 2. EVENT RETRIEVAL AND FILTERING
// --------------------------

// Function to fetch books from relays
async function fetchBooks(relays, filter = {}) {
  const { NostrFetcher } = require('nostr-fetch');
  
  // Initialize fetcher with relays
  const fetcher = new NostrFetcher(relays);
  
  // Basic filter for book events
  const baseFilter = {
    kinds: [30051],
    ...filter
  };
  
  // Fetch events
  const events = await fetcher.fetchAllEvents(baseFilter, 500);
  
  // Process events into book objects
  return events.map(event => {
    // Extract book data from tags
    const book = {
      id: event.id,
      pubkey: event.pubkey,
      created_at: event.created_at,
      description: event.content,
      tags: {}
    };
    
    // Process all tags into structured data
    event.tags.forEach(tag => {
      if (tag[0] === 'd') {
        book.uniqueId = tag[1];
      } else if (tag[0] === 'title') {
        book.title = tag[1];
      } else if (tag[0] === 'authors') {
        book.authors = tag.slice(1);
      } else if (tag[0] === 'isbn') {
        book.isbn = tag[1];
      } else if (tag[0] === 'published') {
        book.publishDate = tag[1];
      } else if (tag[0] === 'publisher') {
        book.publisher = tag[1];
      } else if (tag[0] === 'cover') {
        book.coverUrl = tag[1];
      } else if (tag[0] === 'genre') {
        if (!book.genres) book.genres = [];
        book.genres.push(tag[1]);
      } else if (tag[0] === 'summary') {
        book.summary = tag[1];
      } else {
        // Store other tags
        if (!book.tags[tag[0]]) {
          book.tags[tag[0]] = [];
        }
        book.tags[tag[0]].push(tag.slice(1));
      }
    });
    
    return book;
  });
}

// Fetch a user's bookshelves
async function fetchUserBookshelves(relays, pubkey) {
  const { NostrFetcher } = require('nostr-fetch');
  
  // Initialize fetcher with relays
  const fetcher = new NostrFetcher(relays);
  
  // Filter for bookshelf events from specific user
  const filter = {
    kinds: [30052],
    authors: [pubkey]
  };
  
  // Fetch events
  const events = await fetcher.fetchAllEvents(filter, 100);
  
  // Process events into bookshelf objects
  return events.map(event => {
    // Basic bookshelf data
    const bookshelf = {
      id: event.id,
      pubkey: event.pubkey,
      created_at: event.created_at,
      notes: event.content,
      books: []
    };
    
    // Process tags
    event.tags.forEach(tag => {
      if (tag[0] === 'd') {
        bookshelf.uniqueId = tag[1];
      } else if (tag[0] === 'name') {
        bookshelf.name = tag[1];
      } else if (tag[0] === 'description') {
        bookshelf.description = tag[1];
      } else if (tag[0] === 'book') {
        // Process book entries
        // Format: ['book', eventId, status, progress/date]
        bookshelf.books.push({
          eventId: tag[1],
          status: tag[2],
          progress: tag[3],
          completedDate: tag[4]
        });
      }
    });
    
    return bookshelf;
  });
}

// --------------------------
// 3. USER INTERFACE COMPONENTS
// --------------------------

// React component for a book card (example)
function BookCard({ book, onAddToShelf }) {
  return `
import React from 'react';

const BookCard = ({ book, onAddToShelf }) => {
  return (
    <div className="book-card">
      <div className="book-cover">
        {book.coverUrl ? (
          <img src={book.coverUrl} alt={book.title} />
        ) : (
          <div className="book-cover-placeholder">{book.title[0]}</div>
        )}
      </div>
      <div className="book-info">
        <h3 className="book-title">{book.title}</h3>
        <p className="book-authors">{book.authors?.join(', ')}</p>
        {book.publishDate && (
          <p className="book-publish-date">{book.publishDate}</p>
        )}
        {book.genres && (
          <div className="book-genres">
            {book.genres.map(genre => (
              <span key={genre} className="book-genre-tag">{genre}</span>
            ))}
          </div>
        )}
      </div>
      <div className="book-actions">
        <button 
          className="add-to-shelf-button" 
          onClick={() => onAddToShelf(book.id)}
        >
          Add to Shelf
        </button>
      </div>
    </div>
  );
};

export default BookCard;
  `;
}

// --------------------------
// 4. INTEGRATION WITH PRIMAL
// --------------------------

// Example of how to integrate with Primal's API for discovery
async function discoverBooksViaPrimal(query, limit = 20) {
  // This is a conceptual example - actual implementation would depend on Primal's API
  const response = await fetch(`https://api.primal.net/v1/search`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      query,
      kinds: [30051], // Book events
      limit
    })
  });
  
  const data = await response.json();
  
  // Process and return book data
  return data.events.map(event => {
    // Process event into book object (similar to fetchBooks function)
    // ...
  });
}

// --------------------------
// 5. DATA MIGRATION UTILITIES
// --------------------------

// Import from Goodreads CSV export
async function importFromGoodreadsCSV(csvContent, privateKey) {
  const Papa = require('papaparse');
  
  // Parse the CSV content
  const { data } = Papa.parse(csvContent, {
    header: true,
    skipEmptyLines: true
  });
  
  // Process each book entry
  for (const row of data) {
    // Create a book event
    const bookData = {
      id: `goodreads-${row['Book Id']}`,
      title: row['Title'],
      authors: [row['Author']],
      isbn: row['ISBN13'],
      publishDate: row['Year Published'],
      description: '',
      genres: row['Bookshelves'].split(',').map(s => s.trim()).filter(s => s)
    };
    
    const bookEvent = await createBookEvent(privateKey, bookData);
    
    // Publish to relays
    // publishToRelays(bookEvent);
    
    // Create a review if available
    if (row['My Review']) {
      const reviewData = {
        bookEventId: bookEvent.id,
        rating: row['My Rating'],
        readDate: row['Date Read'],
        subject: `Review of ${row['Title']}`,
        content: row['My Review']
      };
      
      const reviewEvent = await createBookReviewEvent(privateKey, reviewData);
      
      // Publish to relays
      // publishToRelays(reviewEvent);
    }
    
    // Add to appropriate shelf based on status
    // This would depend on user's shelf structure
  }
}

// --------------------------
// 6. ZAP-BASED MONETIZATION
// --------------------------

// Implementation of zap functionality for reviews
async function zapReview(privateKey, reviewEventId, amount, comment = '') {
  const pubkey = getPublicKey(privateKey);
  
  // Fetch the review event to get the author's pubkey
  const reviewEvent = await fetchEvent(reviewEventId);
  const recipientPubkey = reviewEvent.pubkey;
  
  // Create a zap request event (NIP-57)
  const zapRequestEvent = {
    kind: 9734, // Zap request
    created_at: Math.floor(Date.now() / 1000),
    content: comment,
    tags: [
      ['p', recipientPubkey],
      ['e', reviewEventId],
      ['relays', ...relays],
      ['amount', amount.toString()],
      ['lnurl', getLightningAddress(recipientPubkey)] // Function to get recipient's lightning address
    ],
    pubkey
  };
  
  // Sign the event
  zapRequestEvent.id = getEventHash(zapRequestEvent);
  zapRequestEvent.sig = await signEvent(zapRequestEvent, privateKey);
  
  // Process the zap payment via Lightning
  // This would integrate with a Lightning wallet
  // processLightningPayment(zapRequestEvent);
  
  return zapRequestEvent;
}

// Function to display zap statistics for a book or review
function getZapStats(events) {
  // Get all zap receipts related to these events
  const zapReceipts = events.filter(e => e.kind === 9735);
  
  // Calculate total zaps
  const totalSats = zapReceipts.reduce((sum, receipt) => {
    // Extract amount from tags
    const amountTag = receipt.tags.find(tag => tag[0] === 'amount');
    if (amountTag && amountTag[1]) {
      return sum + parseInt(amountTag[1], 10);
    }
    return sum;
  }, 0);
  
  // Get unique zappers
  const uniqueZappers = new Set(zapReceipts.map(e => e.pubkey)).size;
  
  return {
    totalSats,
    zapCount: zapReceipts.length,
    uniqueZappers
  };
}

// React component for Zap Button (example)
function ZapButton({ eventId, recipientPubkey, defaultAmounts = [1000, 5000, 10000] }) {
  return `
import React, { useState } from 'react';
import { Lightning } from 'lucide-react';

const ZapButton = ({ eventId, recipientPubkey, defaultAmounts = [1000, 5000, 10000] }) => {
  const [showZapMenu, setShowZapMenu] = useState(false);
  const [customAmount, setCustomAmount] = useState('');
  const [zapComment, setZapComment] = useState('');
  
  const handleZap = async (amount) => {
    try {
      // Implementation would connect to user's wallet
      await window.nostr.zap(recipientPubkey, amount, zapComment, [['e', eventId]]);
      setShowZapMenu(false);
      setZapComment('');
      // Show success notification
    } catch (error) {
      console.error('Error sending zap:', error);
      // Show error notification
    }
  };
  
  return (
    <div className="zap-container">
      <button 
        className="zap-button flex items-center gap-1 text-amber-500"
        onClick={() => setShowZapMenu(!showZapMenu)}
      >
        <Lightning size={16} />
        <span>Zap</span>
      </button>
      
      {showZapMenu && (
        <div className="zap-menu absolute bg-white shadow-lg rounded p-4 z-10">
          <div className="zap-amounts flex flex-wrap gap-2 mb-3">
            {defaultAmounts.map(amount => (
              <button 
                key={amount}
                className="px-3 py-1 bg-amber-100 rounded hover:bg-amber-200"
                onClick={() => handleZap(amount)}
              >
                {amount} sats
              </button>
            ))}
          </div>
          
          <div className="custom-amount mb-3">
            <input
              type="number"
              placeholder="Custom amount (sats)"
              className="w-full p-2 border rounded"
              value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value)}
            />
          </div>
          
          <div className="zap-comment mb-3">
            <textarea
              placeholder="Add a comment (optional)"
              className="w-full p-2 border rounded"
              value={zapComment}
              onChange={(e) => setZapComment(e.target.value)}
            />
          </div>
          
          <div className="flex justify-between">
            <button 
              className="px-3 py-1 bg-gray-200 rounded"
              onClick={() => setShowZapMenu(false)}
            >
              Cancel
            </button>
            <button 
              className="px-3 py-1 bg-amber-500 text-white rounded"
              onClick={() => handleZap(parseInt(customAmount, 10) || 1000)}
              disabled={!customAmount && !defaultAmounts.length}
            >
              Send Zap
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ZapButton;
  `;
}

// --------------------------
// 7. BOOK CLUB FUNCTIONALITY
// --------------------------

// Create a book club event
async function createBookClubEvent(privateKey, clubData) {
  const pubkey = getPublicKey(privateKey);
  
  // Basic tags for the club
  const tags = [
    ['d', clubData.id],
    ['name', clubData.name],
    ['e', clubData.bookEventId], // Reference to the book
  ];
  
  // Add schedule information
  if (clubData.startDate) {
    tags.push(['start', clubData.startDate]);
  }
  if (clubData.endDate) {
    tags.push(['end', clubData.endDate]);
  }
  
  // Add discussion schedule
  if (clubData.discussions && clubData.discussions.length > 0) {
    clubData.discussions.forEach(discussion => {
      tags.push(['discussion', discussion.date, discussion.topic, discussion.pages || '']);
    });
  }
  
  // Create the event object
  const event = {
    kind: 30055,
    created_at: Math.floor(Date.now() / 1000),
    tags: tags,
    content: clubData.description || '',
    pubkey
  };
  
  // Sign the event
  event.id = getEventHash(event);
  event.sig = await signEvent(event, privateKey);
  
  return event;
}

// --------------------------
// 7. IMPLEMENTATION NOTES
// --------------------------

/*
RELAY STRATEGY

For a production NostrReads implementation, consider the following relay strategy:

1. Book Metadata Relays:
   - high-capacity, read-optimized relays for book data
   - consider having community-maintained "canonical" book relays

2. Personal Library Relays:
   - user's preferred relays for personal data
   - possibility for private, encrypted shelves

3. Review Aggregation:
   - specialized relays that focus on collecting and serving reviews
   - possibly implement NIP-56 (reporting) for abusive content

4. Discovery Relays:
   - integration with existing discovery services like Primal
   - specialized book recommendation algorithms

DATABASE CONSIDERATIONS

While Nostr is fundamentally event-based, local clients may want to maintain
SQLite or similar databases for efficient querying and offline access:

- Books table: normalized book metadata
- Shelves table: user's shelves and organization
- Reviews table: for efficient review aggregation and statistics

PERFORMANCE OPTIMIZATION

For large libraries or active book communities:

1. Implement pagination for book discovery
2. Use event deduplication for commonly referenced books
3. Consider client-side caching of popular books
4. Implement lazy loading for images and content

*/

// --------------------------
// 8. EXAMPLE USAGE
// --------------------------

async function nostrReadsExample() {
  // This is a conceptual example of how the above functions would be used
  
  // 1. Set up connection to relays
  const relays = [
    'wss://relay.damus.io',
    'wss://relay.nostr.band',
    'wss://nos.lol'
  ];
  
  // 2. User creates a new book entry
  const myPrivateKey = 'nsec...'; // User's private key
  const dune = {
    id: 'dune-frank-herbert',
    title: 'Dune',
    authors: ['Frank Herbert'],
    isbn: '9780441172719',
    publishDate: '1965-08-01',
    publisher: 'Ace Books',
    coverUrl: 'https://covers.openlibrary.org/b/id/8643691-L.jpg',
    genres: ['science fiction', 'fantasy', 'classic'],
    description: 'Set on the desert planet Arrakis, Dune is the story of the boy Paul Atreides, heir to a noble family tasked with ruling an inhospitable world where the only thing of value is the "spice" melange, a drug capable of extending life and enhancing consciousness.'
  };
  
  const duneEvent = await createBookEvent(myPrivateKey, dune);
  // publishToRelays(duneEvent, relays);
  
  // 3. User adds the book to their "read" shelf
  const myShelf = {
    id: 'my-sci-fi-shelf',
    name: 'Science Fiction Favorites',
    description: 'My all-time favorite sci-fi novels',
    books: [
      {
        eventId: duneEvent.id,
        status: 'read',
        completedDate: '2023-05-15'
      }
    ]
  };
  
  const shelfEvent = await createBookshelfEvent(myPrivateKey, myShelf);
  // publishToRelays(shelfEvent, relays);
  
  // 4. User writes a review
  const myReview = {
    bookEventId: duneEvent.id,
    rating: '5',
    readDate: '2023-05-15',
    subject: 'A timeless masterpiece',
    content: 'Frank Herbert's Dune is a triumph of imagination and worldbuilding...'
  };
  
  const reviewEvent = await createBookReviewEvent(myPrivateKey, myReview);
  // publishToRelays(reviewEvent, relays);
  
  // 5. Discover other books in the network
  const scienceFictionBooks = await fetchBooks(relays, {
    '#genre': ['science fiction']
  });
  
  console.log(`Found ${scienceFictionBooks.length} sci-fi books in the Nostr network`);
  
  // 6. Find other users' reviews of the same book
  const otherReviews = await fetchBookReviews(relays, duneEvent.id);
  
  console.log(`Found ${otherReviews.length} other reviews for Dune`);
}