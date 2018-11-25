import React, { Component } from 'react';
import { connect } from 'react-redux';
import './Header.css';
import { asyncOpenDrawer, asyncCloseDrawer } from '../../actions/viewActions';

class Header extends Component {
  render() {
    return (
      <div className={this.props.scroll ? "header sticky" : "header"}>
        <div className="headerMenuBar" onClick={() => {this.props.drawer ? this.props.closeDrawer() : this.props.openDrawer()}}>
          <i className="material-icons headerIcons">menu</i>
        </div>
        <div className="title">
          <a href="http://localhost:3000" className="siteTitleLink"><h1>POLITICANDO</h1></a>
        </div>
        <div className="headerMenuBar">
          <div className="iconsContainer">
            <i className="material-icons iconsMenuBoard">brightness_7</i>
          </div>
        </div>
      </div>
    );
  }
}

function mapStateToProps(state) {
  return {
    drawer: state.view.drawer
  };
}

function mapDispatchToProps(dispatch) {
  return {
    openDrawer: () => {
      dispatch(asyncOpenDrawer())
    },
    closeDrawer: () => {
      dispatch(asyncCloseDrawer())
    }
  };
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(Header);
