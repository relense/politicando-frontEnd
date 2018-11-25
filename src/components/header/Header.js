import React, { Component } from 'react';
import { connect } from 'react-redux';
import './Header.css';
import { asyncOpenDrawer, asyncCloseDrawer, asyncChangeDarkMode } from '../../actions/viewActions';

class Header extends Component {
  render() {
    return (
      <div className={this.props.darkMode ? this.props.scroll  ? 'header sticky headerDark' : 'header headerDark' : 'header'}>
        <div className="headerMenuBar" onClick={() => {this.props.drawer ? this.props.closeDrawer() : this.props.openDrawer()}}>
          <i className={this.props.darkMode ? 'material-icons headerIcons iconDarkMode' : 'material-icons headerIcons'}>menu</i>
        </div>
        <div className="title">
          <a href="http://localhost:3000" className={this.props.darkMode ? ' siteTitleLinkDark' : 'siteTitleLink'}><h1>POLITICANDO</h1></a>
        </div>
        <div className="headerMenuBar">
          <div className="iconsContainer" onClick={() => this.props.changeDarkMode()}>
            <i className={this.props.darkMode ? 'material-icons headerIcons iconDarkMode' : 'material-icons headerIcons'}>brightness_7</i>
          </div>
        </div>
      </div>
    );
  }
}

function mapStateToProps(state) {
  return {
    drawer: state.view.drawer,
    darkMode: state.view.darkMode
  };
}

function mapDispatchToProps(dispatch) {
  return {
    openDrawer: () => {
      dispatch(asyncOpenDrawer());
    },
    closeDrawer: () => {
      dispatch(asyncCloseDrawer());
    },
    changeDarkMode: () => {
      dispatch(asyncChangeDarkMode());
    }
  };
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(Header);
