import React, { Component } from 'react';
import './Header.css';

class Header extends Component {
  render() {
    return (
      <div className="header">
        <div className="nav">
          <div className="navElems">Sobre</div>
          <div className="navElems">Dúvidas</div>
          <div className="navElems">Partidos</div>
        </div>
      </div>
    );
  }
}

export default Header;
