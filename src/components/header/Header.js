import React, { Component } from 'react';
import { connect } from 'react-redux';
import './Header.css';
import { asyncChangeView } from '../../actions/viewActions';
import { asyncChangeCurrentPartie } from '../../actions/partiesActions';

const HOME = 'HOME';
const ABOUT = 'ABOUT';
const VOTES = 'VOTES';
const PARTIES = 'PARTIES';
const IDEOLOGIES = 'IDEOLOGIES';

class Header extends Component {
  constructor(props){
    super(props);

    this.state = {
      current: HOME,
      currentPartie: "",
      open: false,
      index: null
    }
  }

  changeElem = (current) => {
    this.setState({
      current: current
    })
  }

  changePartie = (partie) => {
    this.setState({
      currentPartie: partie
    })
  }

  selectPartie = (i) => {
    this.props.changeView("Partie");
    this.props.changeCurrentPartie(this.props.parties[i]);

    this.setState({
      open: this.state.open ? ((this.state.index === i) ? false : true) : true,
      index: i
    })
  }

  elemFuncs = (currentElem, i = -1) => {

    if(i !== -1) {
      this.selectPartie(i);
      this.changePartie(currentElem);

      return;
    } else {
      this.props.changeView("Home");
      this.changePartie("");
    }

    this.changeElem(currentElem);
  }



  renderMainRow = () => {
    let data = [];

    if(this.state.current === HOME) {
      data.push(<div key={HOME} className="navElems selectedElem" onClick={() => this.elemFuncs(HOME)}>Home</div>);
    } else {
      data.push(<div key={HOME} className="navElems" onClick={() => this.elemFuncs(HOME)}>Home</div>);
    }

    if(this.state.current  === ABOUT) {
      data.push(<div key={ABOUT} className="navElems selectedElem" onClick={() => this.elemFuncs(ABOUT)}>Sobre</div>)
    } else {
      data.push(<div key={ABOUT} className="navElems" onClick={() => this.elemFuncs(ABOUT)}>Sobre</div>)
    }

    if(this.state.current  === VOTES) {
      data.push(<div key={VOTES} className="navElems selectedElem" onClick={() => this.elemFuncs(VOTES)}>Votações</div>)
    } else {
      data.push(<div key={VOTES} className="navElems" onClick={() => this.elemFuncs(VOTES)}>Votações</div>)
    }

    if(this.state.current  === PARTIES) {
      data.push(<div key={PARTIES} className="navElems selectedElem" onClick={() => this.elemFuncs(PARTIES)}>Partidos</div>)
    } else {
      data.push(<div key={PARTIES} className="navElems" onClick={() => this.elemFuncs(PARTIES)}>Partidos</div>)
    }

    if(this.state.current  === IDEOLOGIES) {
      data.push(<div key={IDEOLOGIES} className="navElems selectedElem" onClick={() => this.elemFuncs(IDEOLOGIES)}>Ideologias</div>)
    } else {
      data.push(<div key={IDEOLOGIES} className="navElems" onClick={() => this.elemFuncs(IDEOLOGIES)}>Ideologias</div>)
    }

    return data;

  }

  renderPartieRow = () => {
    let data = [];

    if (this.props.parties.length !== 0) {
      for(let i = 0; i < this.props.parties.length; i++) {
        if(this.state.currentPartie === this.props.parties[i].party_name) {
          data.push(
              <div key={i} className="navElems selectedElem" onClick={() => this.elemFuncs(this.props.parties[i].party_name, i)}>
                  { this.props.parties[i].party_name }
              </div>
          );
        } else {
          data.push(
              <div key={i} className="navElems" onClick={() => this.elemFuncs(this.props.parties[i].party_name, i)}>
                  { this.props.parties[i].party_name }
              </div>
          );
        }
      }
    }

    return data;
  }

  renderIdeologiesRow = () => {
    return;
  }

  render() {
    return (
      <div className="header">

        <div className="title">
          <h1>Politicando</h1>
        </div>

        <div className="nav">
          { this.renderMainRow() }
        </div>

        {
          this.state.current === PARTIES &&
            <div className="nav">
              { this.renderPartieRow() }
            </div>
        }

      </div>
    );
  }
}

function mapStateToProps(state) {
  return {
    parties: state.parties.partieList,
    estado: state
  };
}

function mapDispatchToProps(dispatch) {
  return {
    changeView: (view) => {
      dispatch(asyncChangeView(view))
    },
    changeCurrentPartie: (partie) => {
      dispatch(asyncChangeCurrentPartie(partie))
    }
  };
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(Header);
