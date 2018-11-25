import React, { Component } from 'react';
import { connect } from 'react-redux';
import './Header.css';
import { asyncOpenDrawer, asyncCloseDrawer, asyncChangeDarkMode } from '../../actions/viewActions';
import { checkDarkMode, checkDarkModeBackground } from '../../utils/CheckDarkMode.js';

class Header extends Component {
  render() {
    return (
      <div className={this.props.scroll ? ('header sticky noSelect' + checkDarkModeBackground(this.props.darkMode)) : ('header' + checkDarkModeBackground(this.props.darkMode))}>
        <div className="headerMenuBar" onClick={() => {this.props.drawer ? this.props.closeDrawer() : this.props.openDrawer()}}>
          <i className={'material-icons headerIcons' + checkDarkMode(this.props.darkMode, true)}>menu</i>
        </div>
        <div className="title">
          <a href="http://localhost:3000" className={'siteTitleLink' + checkDarkMode(this.props.darkMode, true)}><h1>POLITICANDO</h1></a>
        </div>
        <div className="headerMenuBar">
          <div className="iconsContainerHeader noSelect" onClick={() => this.props.changeDarkMode()}>
            <i className={'material-icons headerIcons' + checkDarkMode(this.props.darkMode, true)}>brightness_7</i>
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
