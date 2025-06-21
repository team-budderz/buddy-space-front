'use client';
import React, { useState } from 'react';
import styles from './navbar.module.css';

export default function Navbar() {
    const [isChatActive, setIsChatActive] = useState(false);
    const [isBellActive, setIsBellActive] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    return (
        <div className={styles.navbar}>
            <header className={styles.header}>
                <img src="/test.png" alt="Logo" />
                <div className={styles.searchBox}>
                    <input
                        type="text"
                        placeholder="검색어를 입력"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <button className={styles.searchButton}>
                        <i className="bi bi-search"></i>
                    </button>
                </div>
                <div className={styles.buttonGroup}>
                    <button onClick={() => setIsBellActive(prev => !prev)}>
                        <i className={`bi bi-bell-fill ${isBellActive ? styles.activeIcon : ''}`}></i>
                    </button>
                    <button onClick={() => setIsChatActive(prev => !prev)}>
                        <i className={`bi bi-chat-dots-fill ${isChatActive ? styles.activeIcon : ''}`}></i>
                    </button>
                </div>
            </header>
        </div>
    );
}